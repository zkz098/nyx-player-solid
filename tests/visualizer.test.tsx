import { describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createHTMLAudioAdapter } from "@/core/audio-adapter";
import { createPlayerStore, PlayerProvider } from "@/player/store";
import {
  cpuPerformanceLevel,
  Visualizer,
  visualizerFrameIntervalMs,
} from "@/player/components/Visualizer";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * R4 8.6 音频可视化测试：
 * - Visualizer 渲染 canvas（jsdom 无 canvas 2d/AudioContext → 分析路径静默降级，不报错）
 * - 适配器层：无 AudioContext 环境 getContextAnalysis() → null；noop adapter → null
 * - 挂载即运行 / 卸载停止（rAF 由组件生命周期管理）
 */

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [{ name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: "" }],
  },
];

describe("Visualizer 组件", () => {
  it("渲染 canvas（分析不可用环境静默降级）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    const view = render(() => (
      <PlayerProvider store={store}>
        <Visualizer />
      </PlayerProvider>
    ));
    const canvas = view.container.querySelector("canvas[data-testid=visualizer]");
    expect(canvas).not.toBeNull();
    expect(view.getByLabelText("音频可视化")).toBeInTheDocument();
  });

  it("FakeAudioAdapter 无分析能力时 player.getAnalyser() 返回 null（不崩）", async () => {
    const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
    await store.init();
    expect(store.getAnalyser()).toBeNull();
  });
});

describe("CPU 性能层级探测（WICG cpu-performance 渐进增强）", () => {
  it("浏览器未实现（jsdom）时返回 null", () => {
    expect("cpuPerformance" in navigator).toBe(false);
    expect(cpuPerformanceLevel()).toBeNull();
  });

  it("识别合法层级 1-4；非法/越界值归一为 null", () => {
    const define = (value: unknown): (() => void) => {
      Object.defineProperty(navigator, "cpuPerformance", { value, configurable: true });
      return () => {
        Reflect.deleteProperty(navigator, "cpuPerformance");
      };
    };
    const cleanup: Array<() => void> = [];
    try {
      cleanup.push(define(4));
      expect(cpuPerformanceLevel()).toBe(4);
      cleanup.push(define(1));
      expect(cpuPerformanceLevel()).toBe(1);
      cleanup.push(define(0));
      expect(cpuPerformanceLevel()).toBeNull();
      cleanup.push(define(5));
      expect(cpuPerformanceLevel()).toBeNull();
      cleanup.push(define("4"));
      expect(cpuPerformanceLevel()).toBeNull();
      cleanup.push(define(Number.NaN));
      expect(cpuPerformanceLevel()).toBeNull();
    } finally {
      cleanup.forEach((fn) => fn());
    }
  });

  it("帧间隔决策：层级 >=4 → 60fps(16ms)，否则/不支持 → 30fps(33ms)", () => {
    expect(visualizerFrameIntervalMs(4)).toBe(16);
    expect(visualizerFrameIntervalMs(3)).toBe(33);
    expect(visualizerFrameIntervalMs(1)).toBe(33);
    expect(visualizerFrameIntervalMs(null)).toBe(33);
  });
});

describe("HTMLAudioAdapter 分析链", () => {
  it("无 AudioContext 环境（jsdom）getContextAnalysis 返回 null", () => {
    // jsdom 无 AudioContext 全局：适配器守卫应返回 null 而非抛错
    expect(globalThis.AudioContext).toBeUndefined();
    const adapter = createHTMLAudioAdapter();
    expect(adapter.getContextAnalysis?.() ?? null).toBeNull();
  });
});

describe("Visualizer 降级与生命周期", () => {
  it("jsdom 无 2d context 时渲染 + 卸载不抛错（rAF 循环未启动，无泄漏）", async () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    try {
      const store = createPlayerStore({ sources, adapter: new FakeAudioAdapter() });
      await store.init();
      const view = render(() => (
        <PlayerProvider store={store}>
          <Visualizer />
        </PlayerProvider>
      ));
      expect(() => view.unmount()).not.toThrow();
    } finally {
      raf.mockRestore();
    }
  });
});
