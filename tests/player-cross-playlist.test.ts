import { describe, expect, it } from "vitest";
import type { MetadataProvider, Song } from "@/core";
import { currentSongOf, PlayerCore } from "@/core/player";
import type { PlaylistSource } from "@/core/types";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * R4 8.5 跨歌单连续播放 + 播放历史：
 * - ended/next 在歌单末跨到下一非空歌单（环形），与 mode=loop 语义隔离
 * - 历史栈：后退/前进/清空；主动导航丢弃 forward 分支；back 可回到初始歌曲
 */

function songs(...names: string[]): Song[] {
  return names.map((name) => ({
    name,
    artist: "x",
    url: `https://x/${name}.mp3`,
    pic: "",
    lrc: "",
  }));
}

const twoLists: Song[][] = [songs("s0", "s1", "s2"), songs("t0", "t1")];

function playlistSources(list: Song[][]): PlaylistSource[] {
  return list.map((songsList, i) => ({ name: `list${i}`, songs: songsList }));
}

/** 测试用直链 provider：按歌单名映射歌曲表 */
function directProvider(songList: Song[][]): MetadataProvider {
  return {
    name: "direct",
    match: () => true,
    async fetchSongs(source: PlaylistSource) {
      const index = Number(source.name.replace("list", ""));
      return songList[index] ?? [];
    },
  };
}

async function createPlayer(list: Song[][] = twoLists) {
  const adapter = new FakeAudioAdapter();
  const player = new PlayerCore({ adapter, provider: directProvider(list) });
  await player.init(playlistSources(list));
  return { player, adapter };
}

describe("跨歌单连续播放（ended / next 语义）", () => {
  it("ended 播完当前歌单末首 → 下一歌单第一首并保持播放", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    player.next();
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    adapter.fireEnded();
    expect(currentSongOf(player.getState())?.name).toBe("t0");
    expect(player.getState().playlistIndex).toBe(1);
    expect(adapter.playing).toBe(true);
  });

  it("最后一个歌单播完回绕到首个歌单（环形连续播）", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    player.next(); // s1
    player.next(); // s2
    player.next(); // 跨 → t0
    player.next(); // t1（list1 末首）
    adapter.fireEnded(); // t1 播完 → 回 list0 第一首
    expect(currentSongOf(player.getState())?.name).toBe("s0");
    expect(player.getState().playlistIndex).toBe(0);
  });

  it("跳过空歌单（list0 末 → 跨过空 list1 → list2 首）", async () => {
    const { player } = await createPlayer([songs("a0", "a1"), [], songs("c0")]);
    player.next(); // a1
    player.next(); // a1 末 → 跳过空 list1 → list2 c0
    expect(currentSongOf(player.getState())?.name).toBe("c0");
    expect(player.getState().playlistIndex).toBe(2);
  });

  it("mode=loop 不跨歌单（单曲循环优先，R4 语义隔离）", async () => {
    const { player, adapter } = await createPlayer();
    player.setMode("loop");
    player.play();
    player.next(); // loop 下重播当前曲（不切歌）
    expect(currentSongOf(player.getState())?.name).toBe("s0");
    adapter.seek(30);
    adapter.fireEnded();
    expect(currentSongOf(player.getState())?.name).toBe("s0"); // 仍当前曲（单曲循环）
    expect(adapter.currentTime).toBe(0);
    expect(player.getState().playlistIndex).toBe(0);
  });

  it("单歌单时跨歌单退化为歌单内回绕（向后兼容）", async () => {
    const { player } = await createPlayer([songs("a", "b", "c")]);
    player.next();
    player.next();
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("a");
  });

  it("全部歌单为空时 next 原地不动", async () => {
    const { player } = await createPlayer([[], []]);
    player.next();
    expect(player.getState().playlistIndex).toBe(0);
    expect(currentSongOf(player.getState())).toBeNull();
  });
});

describe("播放历史（back / forward / clear）", () => {
  it("back 逐级回退到初始歌曲；forward 逐级前进", async () => {
    const { player } = await createPlayer();
    player.next(); // s1
    player.next(); // s2
    expect(player.getHistory()).toEqual([
      { playlistIndex: 0, songIndex: 0 },
      { playlistIndex: 0, songIndex: 1 },
      { playlistIndex: 0, songIndex: 2 },
    ]);

    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s1");
    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s0"); // 回到初始
    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s0"); // 到顶不动

    player.forward();
    expect(currentSongOf(player.getState())?.name).toBe("s1");
    player.forward();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    player.forward();
    expect(currentSongOf(player.getState())?.name).toBe("s2"); // 到末不动
  });

  it("跨歌单导航也记录历史（back 可跨歌单回退）", async () => {
    const { player } = await createPlayer();
    player.next(); // s1
    player.next(); // s2
    player.next(); // t0（跨歌单）
    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    expect(player.getState().playlistIndex).toBe(0);
  });

  it("back 后重新导航丢弃 forward 分支", async () => {
    const { player } = await createPlayer();
    player.next(); // s1
    player.next(); // s2
    player.back(); // s1
    player.next(); // 重新导航 → s2（丢弃原 forward 分支，无变化）
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    // 现在从 s2 去 t0，history 尾部 = [{s0},{s1},{s2},{t0}]
    player.next();
    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    player.back();
    expect(currentSongOf(player.getState())?.name).toBe("s1");
  });

  it("clearHistory 清空且不影响当前播放", async () => {
    const { player } = await createPlayer();
    player.next();
    player.next();
    player.clearHistory();
    expect(player.getHistory()).toEqual([]);
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    player.back(); // 无历史，不动
    expect(currentSongOf(player.getState())?.name).toBe("s2");
  });

  it("历史导航保持播放状态（back 不停播）", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    player.next();
    player.back();
    expect(adapter.playing).toBe(true);
    expect(currentSongOf(player.getState())?.name).toBe("s0");
  });
});
