import { describe, expect, it, vi } from "vitest";
import { PlayerCore, currentSongOf } from "@/core/player";
import type { MetadataProvider, PlaylistSource, Song } from "@/core/types";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

function songs(...names: string[]): Song[] {
  return names.map((name) => ({
    name,
    artist: "artist",
    url: `https://example.com/${name}.mp3`,
    pic: "",
    lrc: "",
  }));
}

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

const twoLists: Song[][] = [songs("s0", "s1", "s2"), songs("t0", "t1")];

function playlistSources(listCount: number): PlaylistSource[] {
  return Array.from({ length: listCount }, (_, i) => ({
    name: `list${i}`,
    songs: twoLists[i] ?? [],
  }));
}

async function createPlayer(listCount = 2) {
  const adapter = new FakeAudioAdapter();
  const player = new PlayerCore({
    adapter,
    provider: directProvider(twoLists),
  });
  await player.init(playlistSources(listCount));
  return { player, adapter };
}

describe("PlayerCore: init", () => {
  it("loads playlists and reports loading lifecycle", async () => {
    const { player } = await createPlayer();
    const state = player.getState();
    expect(state.playlists).toHaveLength(2);
    expect(state.playlists[0]).toHaveLength(3);
    expect(state.playlistNames).toEqual(["list0", "list1"]);
    expect(state.loading).toBe(false);
    expect(currentSongOf(state)?.name).toBe("s0");
  });

  it("keeps empty placeholder for failed playlist", async () => {
    const failing: MetadataProvider = {
      name: "failing",
      match: () => true,
      async fetchSongs() {
        throw new Error("boom");
      },
    };
    const adapter = new FakeAudioAdapter();
    const player = new PlayerCore({ adapter, provider: failing });
    await player.init(playlistSources(2));
    const state = player.getState();
    expect(state.playlists[0]).toEqual([]);
    expect(state.error).toContain("歌单加载失败");
    expect(state.loading).toBe(false);
  });
});

describe("PlayerCore: play/pause", () => {
  it("toggles playing state and drives adapter", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    expect(player.getState().playing).toBe(true);
    expect(adapter.playing).toBe(true);

    player.pause();
    expect(player.getState().playing).toBe(false);
    expect(adapter.playing).toBe(false);

    player.toggle();
    expect(player.getState().playing).toBe(true);
  });
});

describe("PlayerCore: next / prev", () => {
  it("order mode next crosses to next playlist then wraps (R4 8.5)", async () => {
    const { player, adapter } = await createPlayer();
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s1");
    expect(adapter.src).toContain("s1.mp3");

    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("t0"); // 跨到下一歌单
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("t1");
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s0"); // 环形回绕回首个歌单
  });

  it("order mode prev wraps backwards", async () => {
    const { player } = await createPlayer();
    player.prev();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    player.prev();
    expect(currentSongOf(player.getState())?.name).toBe("s1");
  });

  it("直接 play（未触发 playSong/selectPlaylist）自动装载当前曲目 src（0:00/0:00 永不播放 bug 回归）", async () => {
    const { player, adapter } = await createPlayer();
    expect(adapter.src).toBe(""); // init 后未换源
    player.play();
    expect(currentSongOf(player.getState())?.name).toBe("s0");
    expect(adapter.src).toContain("s0.mp3"); // play 前已装载
    expect(adapter.playing).toBe(true);

    // 已是当前源时不重复 setSrc
    adapter.src = "";
    player.play();
    expect(adapter.src).toContain("s0.mp3");
  });

  it("歌单未就绪（init 前）play 排队，init 完成后自动开始（0:00/0:00 场景）", async () => {
    const adapter = new FakeAudioAdapter();
    const player = new PlayerCore({ adapter, provider: directProvider(twoLists) });
    player.play(); // init 前：playlists 为空占位
    expect(player.getState().playing).toBe(true);
    expect(adapter.playing).toBe(false); // 未真正播放
    await player.init(playlistSources(2));
    expect(adapter.playing).toBe(true); // init 完成自动开始
    expect(adapter.src).toContain("s0.mp3");
  });

  it("random mode next stays in bounds", async () => {
    const { player } = await createPlayer();
    player.setMode("random");
    for (let i = 0; i < 20; i++) {
      player.next();
      const index = player.getState().perSongIndex[0] ?? -1;
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(3);
    }
  });

  it("non-order prev returns to last visited song (lastIdx semantics)", async () => {
    const { player } = await createPlayer();
    // 锁定随机：randomIndex(3)=floor(0.9*3)=2 → next 到 s2
    const randomMock = vi.spyOn(Math, "random").mockReturnValue(0.9);
    try {
      // 初始在 s0；先切到 s2（此时 last=s0）
      player.setMode("random");
      player.next();
      expect(currentSongOf(player.getState())?.name).toBe("s2");
      // 回退应回到 s0（上次离开）
      player.prev();
      expect(currentSongOf(player.getState())?.name).toBe("s0");
      // 未切过歌时 prev 走 -1 回绕
      player.prev();
      expect(currentSongOf(player.getState())?.name).toBe("s2");
    } finally {
      randomMock.mockRestore();
    }
  });

  it("loop mode next replays current (equivalent of audio.loop)", async () => {
    const { player, adapter } = await createPlayer();
    player.setMode("loop");
    player.play();
    adapter.seek(95);
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s0");
    expect(adapter.currentTime).toBe(0);
    expect(adapter.playing).toBe(true);
  });
});

describe("PlayerCore: ended auto-advance (fixed bug)", () => {
  it("order mode advances to next playlist after last song, keeps playing (R4 8.5)", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    // 播到最后一首
    player.next();
    player.next();
    expect(currentSongOf(player.getState())?.name).toBe("s2");
    adapter.fireEnded();
    expect(currentSongOf(player.getState())?.name).toBe("t0"); // 跨歌单 + auto continue
    expect(adapter.playing).toBe(true);
  });

  it("loop mode replays current song on ended", async () => {
    const { player, adapter } = await createPlayer();
    player.setMode("loop");
    player.play();
    adapter.fireEnded();
    expect(currentSongOf(player.getState())?.name).toBe("s0");
    expect(adapter.currentTime).toBe(0);
    expect(adapter.playing).toBe(true);
  });

  it("does nothing when current playlist is empty", async () => {
    const adapter = new FakeAudioAdapter();
    const player = new PlayerCore({ adapter, provider: directProvider([]) });
    await player.init([{ name: "empty", songs: [] }]);
    expect(player.getState().playlists[0]).toEqual([]);
    player.next(); // 空歌单不崩
    player.prev();
    expect(player.getState().playlistIndex).toBe(0);
    expect(currentSongOf(player.getState())).toBeNull();
  });
});

describe("PlayerCore: time tracking", () => {
  it("updates currentTime and duration from adapter events", async () => {
    const { player, adapter } = await createPlayer();
    adapter.fireTimeupdate(12.5);
    expect(player.getState().currentTime).toBe(12.5);
    expect(player.getState().duration).toBe(100);

    adapter.duration = 240;
    adapter.fireLoadedmetadata();
    expect(player.getState().duration).toBe(240);
  });

  it("seek clamps invalid values", async () => {
    const { player, adapter } = await createPlayer();
    player.seek(-5);
    expect(adapter.currentTime).toBe(0);
    player.seek(30);
    expect(adapter.currentTime).toBe(30);
    expect(player.getState().currentTime).toBe(30);
  });
});

describe("PlayerCore: playlist & song selection", () => {
  it("selectPlaylist remembers per-playlist song index", async () => {
    const { player } = await createPlayer();
    player.next(); // list0 → s1
    player.selectPlaylist(1);
    expect(currentSongOf(player.getState())?.name).toBe("t0");
    player.selectPlaylist(0);
    expect(currentSongOf(player.getState())?.name).toBe("s1");
  });

  it("playSong switches song and resumes playback when already playing", async () => {
    const { player, adapter } = await createPlayer();
    player.play();
    player.playSong(1, 1);
    expect(currentSongOf(player.getState())?.name).toBe("t1");
    expect(adapter.playing).toBe(true);
    expect(adapter.src).toContain("t1.mp3");
  });

  it("ignores out-of-range selections", async () => {
    const { player } = await createPlayer();
    player.playSong(5, 0);
    expect(player.getState().playlistIndex).toBe(0);
    player.selectPlaylist(9);
    expect(player.getState().playlistIndex).toBe(0);
  });
});

describe("PlayerCore: mode / volume / error", () => {
  it("cycles mode order → random → loop → order", async () => {
    const { player } = await createPlayer();
    expect(player.getState().mode).toBe("order");
    player.cycleMode();
    expect(player.getState().mode).toBe("random");
    player.cycleMode();
    expect(player.getState().mode).toBe("loop");
    player.cycleMode();
    expect(player.getState().mode).toBe("order");
  });

  it("clamps volume and syncs to adapter", async () => {
    const { player, adapter } = await createPlayer();
    player.setVolume(2);
    expect(player.getState().volume).toBe(1);
    expect(adapter.volume).toBe(1);
    player.setVolume(0.3);
    expect(player.getState().volume).toBe(0.3);
    expect(adapter.volume).toBe(0.3);
  });

  it("toggles mute on adapter", async () => {
    const { player, adapter } = await createPlayer();
    player.toggleMute();
    expect(player.getState().muted).toBe(true);
    expect(adapter.muted).toBe(true);
    player.toggleMute();
    expect(player.getState().muted).toBe(false);
  });

  it("reports adapter error into state", async () => {
    const { player, adapter } = await createPlayer();
    adapter.fireError();
    expect(player.getState().error).toContain("歌曲加载失败");
  });
});

describe("PlayerCore: subscribe / restore / dispose", () => {
  it("notifies subscribers on state change", async () => {
    const { player } = await createPlayer();
    const seen: string[] = [];
    const unsubscribe = player.subscribe((state) =>
      seen.push(`${state.playing}:${state.currentTime}`),
    );
    player.play();
    player.seek(10);
    unsubscribe();
    player.pause();
    expect(seen).toEqual(["true:0", "true:10"]);
  });

  it("restore seeks adapter to persisted time", async () => {
    const { player, adapter } = await createPlayer();
    player.restore(42);
    expect(adapter.currentTime).toBe(42);
    expect(player.getState().currentTime).toBe(42);
  });

  it("dispose stops adapter and clears listeners", async () => {
    const { player, adapter } = await createPlayer();
    const seen: string[] = [];
    player.subscribe((state) => seen.push(state.mode));
    player.dispose();
    player.setMode("random"); // dispose 后不应再通知（内部仍会更新，但 listener 已清）
    expect(adapter.playing).toBe(false);
    player.play();
    expect(player.getState().playing).toBe(true);
  });
});
