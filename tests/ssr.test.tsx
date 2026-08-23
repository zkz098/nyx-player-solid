// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PlaylistSource } from "@/core";
import { parseLyric } from "@/core";
import { createPlayerStore } from "@/player/store";

/**
 * SSR 安全验收（R3 决策，node 环境）：
 * - createPlayerStore 默认适配器在无 Audio 环境安全降级为 no-op（组件渲染路径不崩）
 * - core 纯逻辑无 DOM 依赖
 * 组件级 renderToString 验收走 scripts/ssr-check.mjs（真实 dist/ssr 产物，构建后执行）。
 */

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [{ name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: "" }],
  },
];

describe("SSR 安全（node）", () => {
  it("createPlayerStore 默认适配器在无 Audio 环境不崩溃（no-op 降级）", () => {
    const store = createPlayerStore({ sources });
    const state = store.state;
    expect(state.playing).toBe(false);
    expect(state.playlists).toEqual([]);
    // 动作全部 no-op 安全
    store.play();
    store.next();
    store.seek(10);
    expect(store.state.playing).toBe(true);
  });

  it("core 纯逻辑在 node 直接可用", () => {
    const lines = parseLyric("[00:00.00]a\n[00:05.00]b");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.end).toBe(5);
  });
});
