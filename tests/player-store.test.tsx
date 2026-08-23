import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore, PlayerProvider, usePlayer } from "@/player/store";
import type { StorageLike } from "@/player/store";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * UI 层测试（三级测试的中间级）：store 工厂多实例隔离 + 细粒度订阅 + 持久化 + Context 注入。
 * 用 render 验证信号链路，不依赖真实 audio（FakeAudioAdapter）。
 */

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [
      { name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: "" },
      { name: "B", artist: "y", url: "https://b.mp3", pic: "", lrc: "" },
    ],
  },
];

const PERSIST_KEY = "nyx-player-solid:state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 顶层共用：内存版 storage（memoryStorage 工厂不捕获外部变量，满足 consistent-function-scoping） */
function memoryStorage(): StorageLike & { getItemOnly(): string | null } {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, v: string) => {
      value = v;
    },
    getItemOnly: () => value,
  };
}

function PanelLike(): JSX.Element {
  const { state } = usePlayer();
  return (
    <Show when={state.playing} fallback={<span data-testid="paused">paused</span>}>
      <span data-testid="playing">playing</span>
    </Show>
  );
}

describe("createPlayerStore 多实例隔离（R2 决策：工厂+Context）", () => {
  it("两个实例互不影响（原版全局单例踩踏问题回归）", async () => {
    const storeA = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    const storeB = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });

    await Promise.all([storeA.init(), storeB.init()]);

    storeA.play();
    storeA.next(); // A 实例切到 B 歌曲
    expect(storeA.state.playing).toBe(true);
    expect(storeA.state.perSongIndex[0]).toBe(1);
    // B 实例不受影响
    expect(storeB.state.playing).toBe(false);
    expect(storeB.state.perSongIndex[0] ?? 0).toBe(0);
  });
});

describe("PlayerProvider/usePlayer 注入链路", () => {
  it("Provider + 消费组件读取状态并驱动 toggle", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();

    function Consumer(): JSX.Element {
      const player = usePlayer();
      return (
        <button type="button" onClick={() => player.toggle()}>
          {player.state.playing ? "暂停" : "播放"}
        </button>
      );
    }

    const view = render(() => (
      <PlayerProvider store={store}>
        <Consumer />
      </PlayerProvider>
    ));

    const button = await view.findByRole("button", { name: "播放" });
    expect(button).toBeInTheDocument();
    button.click();
    expect(await view.findByRole("button", { name: "暂停" })).toBeInTheDocument();
  });

  it("无 Provider 时 usePlayer 抛错", () => {
    function Broken(): JSX.Element {
      try {
        void usePlayer();
      } catch {
        return <span data-testid="err">no-provider</span>;
      }
      return <span data-testid="ok">ok</span>;
    }
    const view = render(() => <Broken />);
    expect(view.getByTestId("err")).toBeInTheDocument();
  });
});

describe("store 细粒度订阅（Solid createStore 代理读取）", () => {
  it("state.xxx 只随对应字段变化（信号粒度，DOM 驱动断言）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();

    function Times(): JSX.Element {
      return <span data-testid="time">{store.state.currentTime}</span>;
    }
    function Playing(): JSX.Element {
      return <span data-testid="state">{store.state.playing ? "on" : "off"}</span>;
    }
    const view = render(() => (
      <>
        <Times />
        <Playing />
      </>
    ));

    expect(view.getByTestId("time")).toHaveTextContent("0");
    expect(view.getByTestId("state")).toHaveTextContent("off");

    // 只改 currentTime：time 节点更新，playing 节点保持（细粒度不重渲无关字段）
    store.seek(10);
    await vi.waitFor(() => expect(view.getByTestId("time")).toHaveTextContent("10"));
    expect(view.getByTestId("state")).toHaveTextContent("off");

    // 改 playing：state 节点更新
    store.play();
    await vi.waitFor(() => expect(view.getByTestId("state")).toHaveTextContent("on"));
    expect(view.getByTestId("time")).toHaveTextContent("10");
  });
});

describe("PlayerStore 持久化（字段子集 + storage 适配器）", () => {
  it("save 只写白名单字段（歌单内容不落盘）", async () => {
    vi.useFakeTimers();
    try {
      const storage = memoryStorage();
      const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter(), storage });
      await store.init();
      store.play();
      store.next();
      vi.advanceTimersByTime(400); // debounce 300ms 后落盘
      const raw: unknown = JSON.parse(storage.getItem(PERSIST_KEY) ?? "{}");
      const snapshot = isRecord(raw) ? raw : {};
      expect(snapshot.playing).toBe(true);
      expect(snapshot.perSongIndex).toEqual([1]);
      expect("playlists" in snapshot).toBe(false);
      expect("playlistNames" in snapshot).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restore 恢复 mode/volume + 歌曲位置（playSong 对齐）与进度", async () => {
    const storage = memoryStorage();
    storage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        playing: false,
        currentTime: 30,
        duration: 100,
        mode: "loop",
        playlistIndex: 0,
        perSongIndex: [1], // 恢复到第 2 首歌
        perLastIndex: [0],
        volume: 0.5,
        muted: false,
      }),
    );
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter(), storage });
    await store.init();

    expect(store.state.mode).toBe("loop");
    expect(store.state.volume).toBe(0.5);
    // 歌曲位置对齐到第 2 首 + 进度恢复
    expect(store.state.perSongIndex[0]).toBe(1);
    expect(store.state.currentTime).toBe(30);
  });

  it("位置无效（超出歌单）不恢复进度", async () => {
    const storage = memoryStorage();
    storage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        playing: false,
        currentTime: 45,
        duration: 100,
        mode: "order",
        playlistIndex: 0,
        perSongIndex: [9], // 超出当前歌单长度
        perLastIndex: [0],
        volume: 1,
        muted: false,
      }),
    );
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter(), storage });
    await store.init();
    expect(store.state.currentTime).toBe(0); // 不恢复错位进度
    expect(store.state.perSongIndex[0] ?? 0).toBe(0);
  });

  it("storage 为 null 时完全不做持久化", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter(), storage: null });
    await store.init();
    store.play();
    expect(store.state.playing).toBe(true); // 无存储也不报错
  });
});

describe("Portal 内 Context 再注入（Solid Portal 不穿透 Context）", () => {
  it("Show 子树（模拟 Portal 再注入）能消费 store", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();

    const view = render(() => (
      <PlayerProvider store={store}>
        <Show when={true}>
          <PlayerProvider store={store}>
            <PanelLike />
          </PlayerProvider>
        </Show>
      </PlayerProvider>
    ));

    await vi.waitFor(() => expect(view.getAllByTestId("paused")).toHaveLength(1));
  });
});
