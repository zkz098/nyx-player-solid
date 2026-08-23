import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore, PlayerProvider } from "@/player/store";
import { ProgressBar } from "@/player/components/ProgressBar";
import { Controller } from "@/player/components/Controller";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * R4 8.2 交互测试：
 * - 进度条拖拽（pointer capture 方案）：拖中不写回 currentTime，松手才 seek
 * - 音量滑杆（input[type=range]）：input 事件 → setVolume；mute 联动
 * jsdom 注意：无布局（mock getBoundingClientRect）+ 无 pointer capture API（stub）
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

beforeEach(() => {
  if (typeof Element.prototype.setPointerCapture !== "function") {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (typeof Element.prototype.releasePointerCapture !== "function") {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

interface Setup {
  store: ReturnType<typeof createPlayerStore>;
  adapter: FakeAudioAdapter;
  view: ReturnType<typeof render>;
}

async function setup(): Promise<Setup> {
  const adapter = new FakeAudioAdapter();
  const store = createPlayerStore({ sources, adapter });
  await store.init();
  const view = render(() => (
    <PlayerProvider store={store}>
      <ProgressBar />
      <Controller />
    </PlayerProvider>
  ));
  return { store, adapter, view };
}

function mockTrackRect(track: Element): void {
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 200,
    bottom: 8,
    width: 200,
    height: 8,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe("ProgressBar 渲染与时间显示", () => {
  it("初始（duration 0）显示 0:00 / 0:00；timeupdate 后跟随", async () => {
    const { view, adapter } = await setup();
    const time = view.getByText(/^(0:00)( \/ )/);
    expect(time).toHaveTextContent("0:00 / 0:00");

    adapter.fireTimeupdate(30);
    await vi.waitFor(() => expect(view.getByText(/^0:30 \/ 1:40$/)).toBeInTheDocument());
  });

  it("slider 暴露 aria 值（role=slider + valuenow）", async () => {
    const { view, adapter } = await setup();
    adapter.fireTimeupdate(25);
    await vi.waitFor(() =>
      expect(view.getByRole("slider", { name: "播放进度" })).toHaveAttribute("aria-valuenow", "25"),
    );
  });
});

describe("ProgressBar 拖拽 seek", () => {
  it("拖拽中不写回 currentTime（只显示拖动位置），松手后 store.seek 生效", async () => {
    const { view, store, adapter } = await setup();
    adapter.fireTimeupdate(50); // currentTime=50, duration=100
    await vi.waitFor(() => expect(store.state.currentTime).toBe(50));

    const track = view.getByRole("slider", { name: "播放进度" });
    mockTrackRect(track);

    // pointerdown 到 25% 位置：dragTime=25，但 state 未被写回
    fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
    await vi.waitFor(() => expect(track).toHaveAttribute("aria-valuenow", "25"));
    expect(store.state.currentTime).toBe(50); // 拖中不 seek

    // 拖到 50% 再松手 → 最终 seek 到 50
    fireEvent.pointerMove(track, { clientX: 100, pointerId: 1 });
    await vi.waitFor(() => expect(track).toHaveAttribute("aria-valuenow", "50"));
    expect(store.state.currentTime).toBe(50);

    fireEvent.pointerUp(track, { pointerId: 1 });
    await vi.waitFor(() => expect(store.state.currentTime).toBe(50));
  });

  it("duration=0（未加载）时拖拽无效", async () => {
    const { view, store } = await setup();
    const track = view.getByRole("slider", { name: "播放进度" });
    mockTrackRect(track);

    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(track, { pointerId: 1 });
    expect(store.state.currentTime).toBe(0);
    expect(track).toHaveAttribute("aria-valuenow", "0");
  });

  it("键盘左右方向键 seek ±5s", async () => {
    const { view, store, adapter } = await setup();
    adapter.fireTimeupdate(30);
    const track = view.getByRole("slider", { name: "播放进度" });

    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(store.state.currentTime).toBe(35);
    fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(store.state.currentTime).toBe(30);
  });
});

describe("音量滑杆", () => {
  it("range input 事件 → store.setVolume；muted 时显示 0", async () => {
    const { view, store } = await setup();
    const range = view.getByRole("slider", { name: "音量" });
    expect(range).toHaveProperty("value", "1"); // 初始 volume=1

    fireEvent.input(range, { target: { value: "0.3" } });
    expect(store.state.volume).toBe(0.3);
    expect(store.state.muted).toBe(false);

    // mute 后 range 显示 0（保留原始音量供恢复）
    store.toggleMute();
    await vi.waitFor(() => expect(range).toHaveProperty("value", "0"));
    store.toggleMute();
    await vi.waitFor(() => expect(range).toHaveProperty("value", "0.3"));
  });

  it("拖到 0 自动静音；mute 图标随音量四态变化", async () => {
    const { view, store } = await setup();
    const range = view.getByRole("slider", { name: "音量" });

    fireEvent.input(range, { target: { value: "0" } });
    expect(store.state.muted).toBe(true);
    expect(view.getByRole("button", { name: "取消静音" })).toBeInTheDocument();

    fireEvent.input(range, { target: { value: "0.6" } });
    expect(store.state.muted).toBe(false);
    expect(view.getByRole("button", { name: "静音" })).toBeInTheDocument();
  });
});
