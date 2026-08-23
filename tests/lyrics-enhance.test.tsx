import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore, PlayerProvider } from "@/player/store";
import { Lyrics } from "@/player/components/Lyrics";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * R4 8.3 歌词增强组件测试：
 * - 窗口化渲染（active 居中）+ LLRC 词级 span
 * - 点击行 → store.seek(line.start)
 * - 当前行逐词点亮随 currentTime 推进
 */

const LLRC =
  "[00:00.00]<00:00.00>第 <00:00.50>一个 <00:01.00>词\n[00:10.00]<00:10.00>下 <00:10.50>一行";

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [{ name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: LLRC }],
  },
];

async function setup(): Promise<{
  store: ReturnType<typeof createPlayerStore>;
  view: ReturnType<typeof render>;
}> {
  const adapter = new FakeAudioAdapter();
  const store = createPlayerStore({ sources, adapter });
  await store.init();
  const view = render(() => (
    <PlayerProvider store={store}>
      <Lyrics />
    </PlayerProvider>
  ));
  return { store, view };
}

describe("Lyrics 卡拉 OK 逐字渲染", () => {
  it("LLRC 解析为词级 span（当前行词点亮）", async () => {
    const { view } = await setup();
    const words = view.container.querySelectorAll(".lrc p.current .word");
    // 第一行 active：3 个词；time=0 → 第一个词 active
    expect(words).toHaveLength(3);
    const active = view.container.querySelectorAll(".lrc p.current .word.active");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("第");
    expect(active[0]).toHaveClass("active");
  });

  it("currentTime 推进时逐词点亮（卡拉 OK 进度）", async () => {
    const { store, view } = await setup();
    // t=0.6s：第 1、2 个词已唱
    store.seek(0.6);
    await vi.waitFor(() =>
      expect(view.container.querySelectorAll(".lrc p.current .word.active")).toHaveLength(2),
    );
    // 切到第二行（t=10）：仅第一个词亮
    store.seek(10);
    await vi.waitFor(() => {
      const current = view.container.querySelector(".lrc p.current");
      expect(current).toHaveTextContent("下");
      expect(view.container.querySelectorAll(".lrc p.current .word.active")).toHaveLength(1);
    });
  });

  it("窗口化渲染：active 行恒居中（前后各 2 行）", async () => {
    const many = Array.from(
      { length: 10 },
      (_, i) => `[00:${String(i).padStart(2, "0")}.00]line${i}`,
    ).join("\n");
    const adapter = new FakeAudioAdapter();
    const store = createPlayerStore({
      sources: [
        {
          name: "demo",
          songs: [{ name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: many }],
        },
      ],
      adapter,
    });
    await store.init();
    const view = render(() => (
      <PlayerProvider store={store}>
        <Lyrics />
      </PlayerProvider>
    ));

    store.seek(5);
    await vi.waitFor(() => {
      const rows = [...view.container.querySelectorAll(".lrc ul li")];
      expect(rows).toHaveLength(5); // 3..7
      expect(rows[2]?.querySelector("p")).toHaveClass("current");
      expect(rows[2]).toHaveTextContent("line5");
    });
  });
});

describe("Lyrics 行点击 seek", () => {
  it("点击歌词行 → currentTime 变为该行 start", async () => {
    const { store, view } = await setup();
    // 点第二行（start=10）
    const second = view.container.querySelectorAll(".lrc ul li")[1];
    if (!second) {
      throw new Error("missing second lyric row");
    }
    fireEvent.click(second);
    expect(store.state.currentTime).toBe(10);
    // 点第一行回到 0
    const first = view.container.querySelectorAll(".lrc ul li")[0];
    if (!first) {
      throw new Error("missing first lyric row");
    }
    fireEvent.click(first);
    expect(store.state.currentTime).toBe(0);
  });
});
