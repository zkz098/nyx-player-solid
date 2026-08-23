import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore } from "@/player/store";
import { useMediaSession } from "@/player/media-session";
import type { MediaSessionLike } from "@/player/media-session";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * MediaSession 集成测试（R4 8.1）：
 * - 注入 stub session 验证 handler 注册与转发（FakeAudioAdapter 沿用项目注入哲学）
 * - 元数据 / playbackState 随 store 信号变化
 * - cleanup 解除 handlers；无 session（SSR）环境静默 no-op
 */

/** jsdom 无 MediaMetadata 全局：stub 最小实现验证元数据链路 */
class FakeMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: MediaImage[];

  constructor(init: MediaMetadataInit) {
    this.title = init.title ?? "";
    this.artist = init.artist ?? "";
    this.album = init.album ?? "";
    this.artwork = init.artwork ?? [];
  }
}

beforeAll(() => {
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [
      { name: "A", artist: "x", url: "https://a.mp3", pic: "https://a.jpg", lrc: "" },
      { name: "B", artist: "y", url: "https://b.mp3", pic: "", lrc: "" },
    ],
  },
];

const ACTIONS: MediaSessionAction[] = ["play", "pause", "previoustrack", "nexttrack", "seekto"];

interface SessionStub extends MediaSessionLike {
  handlers: Map<MediaSessionAction, MediaSessionActionHandler | null>;
}

function createSessionStub(): SessionStub {
  const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>();
  return {
    handlers,
    metadata: null,
    playbackState: "none",
    setActionHandler(action, handler) {
      handlers.set(action, handler);
    },
  };
}

describe("useMediaSession handler 注册与转发", () => {
  it("挂载后注册 5 个 action handler（play/pause/previoustrack/nexttrack/seekto）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    expect(session.handlers.size).toBe(5);
    for (const action of ACTIONS) {
      expect(session.handlers.has(action)).toBe(true);
    }
  });

  it("play/pause 转发到 store（toggle 语义）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    session.handlers.get("play")?.({ action: "play" });
    expect(store.state.playing).toBe(true);
    session.handlers.get("pause")?.({ action: "pause" });
    expect(store.state.playing).toBe(false);
  });

  it("previoustrack / nexttrack 转发切歌", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    session.handlers.get("nexttrack")?.({ action: "nexttrack" });
    expect(store.state.perSongIndex[0]).toBe(1);
    session.handlers.get("previoustrack")?.({ action: "previoustrack" });
    expect(store.state.perSongIndex[0]).toBe(0);
  });

  it("seekto 转发 seek（seekTime null 时回退 0）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    session.handlers.get("seekto")?.({ action: "seekto", seekTime: 30 });
    expect(store.state.currentTime).toBe(30);
    // 未携带 seekTime（undefined）时回退 0
    session.handlers.get("seekto")?.({ action: "seekto" });
    expect(store.state.currentTime).toBe(0);
  });

  it("unmount 时解除全部 handlers（setActionHandler null）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    const view = render(() => {
      useMediaSession(store, session);
      return null;
    });
    view.unmount();

    expect(session.handlers.size).toBe(5);
    for (const [, handler] of session.handlers) {
      expect(handler).toBeNull();
    }
  });
});

describe("useMediaSession 元数据与播放状态同步", () => {
  it("metadata 随当前歌曲变化（title/artist/artwork ← Song.pic）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    await vi.waitFor(() => expect(session.metadata?.title).toBe("A"));
    expect(session.metadata?.artist).toBe("x");
    expect(session.metadata?.artwork).toEqual([{ src: "https://a.jpg" }]);

    // 切歌：无 pic 的歌曲 → artwork 空数组
    store.next();
    await vi.waitFor(() => expect(session.metadata?.title).toBe("B"));
    expect(session.metadata?.artwork).toEqual([]);
  });

  it("playbackState 同步 playing 信号", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    render(() => {
      useMediaSession(store, session);
      return null;
    });

    await vi.waitFor(() => expect(session.playbackState).toBe("paused"));
    store.play();
    await vi.waitFor(() => expect(session.playbackState).toBe("playing"));
    store.pause();
    await vi.waitFor(() => expect(session.playbackState).toBe("paused"));
  });
});

describe("useMediaSession 守卫与降级", () => {
  it("无 session（null 注入）时静默 no-op，不注册不报错", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();

    expect(() => {
      render(() => {
        useMediaSession(store, null);
        return null;
      });
    }).not.toThrow();
  });

  it("MediaMetadata 全局缺失时 metadata 置 null，handlers 仍注册", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    // MediaMetadata 缺失降级（stub 置 undefined → typeof 为 "undefined"）
    vi.stubGlobal("MediaMetadata", undefined);

    render(() => {
      useMediaSession(store, session);
      return null;
    });
    expect(session.metadata).toBeNull();
    expect(session.handlers.size).toBe(5); // handlers 不受影响

    vi.unstubAllGlobals(); // 恢复顶层 stub（本 it 是最后一个用例）
  });

  it("组件卸载后再次触发 handler 无副作用（已解绑）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const session = createSessionStub();

    const view = render(() => {
      useMediaSession(store, session);
      return null;
    });
    view.unmount();
    // 解绑后 stub 里的 handler 引用已被清为 null，调用不会切歌
    expect(session.handlers.get("nexttrack")).toBeNull();
  });
});
