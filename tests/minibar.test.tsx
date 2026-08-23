import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore, PlayerProvider } from "@/player/store";
import { MiniBar } from "@/player/components/MiniBar";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * R4 8.4 Mini 形态测试：封面/标题渲染、播放 toggle、展开回调。
 * NyxPlayer mode="mini" 双形态切换单独在 player-store 层验证（Portal 依 jsdom）；
 * 本文件聚焦 MiniBar 组件本身。
 */

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [
      { name: "示例歌曲", artist: "示例歌手", url: "https://a.mp3", pic: "https://a.jpg", lrc: "" },
    ],
  },
];

async function setup(onExpand = vi.fn()) {
  const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
  await store.init();
  const view = render(() => (
    <PlayerProvider store={store}>
      <MiniBar onExpand={onExpand} />
    </PlayerProvider>
  ));
  return { store, view, onExpand };
}

describe("MiniBar 渲染", () => {
  it("显示封面 + 标题/歌手 + 播放 + 展开按钮", async () => {
    const { view } = await setup();
    const bar = view.container.querySelector(".nyx-minibar");
    expect(bar).not.toBeNull();
    expect(bar).toHaveTextContent("示例歌曲");
    expect(bar).toHaveTextContent("示例歌手");
    expect(view.getByRole("img", { name: "音乐封面" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "展开播放器" })).toBeInTheDocument();
  });
});

describe("MiniBar 交互", () => {
  it("播放按钮 toggle（暂无封面图时占位）", async () => {
    const adapter = new FakeAudioAdapter();
    const store = createPlayerStore({
      sources: [
        {
          name: "demo",
          songs: [{ name: "无图", artist: "", url: "https://a.mp3", pic: "", lrc: "" }],
        },
      ],
      adapter,
    });
    await store.init();
    const view = render(() => (
      <PlayerProvider store={store}>
        <MiniBar onExpand={vi.fn()} />
      </PlayerProvider>
    ));

    fireEvent.click(view.getByRole("button", { name: "播放" }));
    await vi.waitFor(() => expect(view.getByRole("button", { name: "暂停" })).toBeInTheDocument());
    expect(store.state.playing).toBe(true);
  });

  it("展开按钮触发 onExpand", async () => {
    const { view, onExpand } = await setup();
    fireEvent.click(view.getByRole("button", { name: "展开播放器" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
