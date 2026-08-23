import { describe, expect, it } from "vitest";
import { PlayerCore, currentSongOf } from "@/core/player";
import type { MetadataProvider, PlaylistSource, Song } from "@/core/types";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * review 回归：多步 prev 的历史回退行为（对照原版 lastIdx 语义）。
 * 用 playSong 确定性铺路（等价用户点击列表切歌，走 updateLast=true），避免 random 不确定性。
 * 序列期望：
 *   s0 --playSong(1)--> s1 (last=s0) --playSong(2)--> s2 (last=s1)
 *   --prev--> 回 s1（不更新 last） --prev--> 继续 -1 回绕到 s0
 */

const songList: Song[] = ["s0", "s1", "s2"].map((name) => ({
  name,
  artist: "a",
  url: `https://e.com/${name}.mp3`,
  pic: "",
  lrc: "",
}));

function provider(): MetadataProvider {
  return {
    name: "direct",
    match: () => true,
    async fetchSongs(source: PlaylistSource) {
      return source.songs ?? [];
    },
  };
}

async function createRandomPlayer() {
  const adapter = new FakeAudioAdapter();
  const player = new PlayerCore({ adapter, provider: provider() });
  await player.init([{ name: "list", songs: songList }]);
  player.setMode("random"); // 非 order 模式才有 lastIdx 回退语义
  return { player };
}

describe("PlayerCore review: prev 多步回退语义", () => {
  it("回退后 last 不被覆盖：prev 不弹回", async () => {
    const { player } = await createRandomPlayer();
    const names = () => currentSongOf(player.getState())?.name;

    player.playSong(0, 1); // s1 (last=s0)
    player.playSong(0, 2); // s2 (last=s1)
    expect(names()).toBe("s2");

    player.prev(); // 回 s1（上次离开）
    expect(names()).toBe("s1");

    // 在"上次歌曲"上继续 prev → -1 回绕到 s0，而不是弹回 s2
    player.prev();
    expect(names()).toBe("s0");
  });

  it("prev 到 -1 回绕时记录 last，序列稳定", async () => {
    const { player } = await createRandomPlayer();
    const names = () => currentSongOf(player.getState())?.name;

    player.playSong(0, 1); // s1 (last=s0)
    player.prev(); // current(1)!==last(0) → 回 s0
    expect(names()).toBe("s0");

    player.prev(); // current===last → -1 回绕到 s2（last 更新为 s0）
    expect(names()).toBe("s2");
    player.prev(); // current(2)!==last(0) → 回 s0
    expect(names()).toBe("s0");
  });
});
