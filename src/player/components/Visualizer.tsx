import { onCleanup, onMount } from "solid-js";
import type { JSX } from "solid-js";
import { usePlayer } from "../store";

const CSS_WIDTH = 300;
const CSS_HEIGHT = 36;
const BAR_COUNT = 48;
/** 默认低帧率（~30fps）：旋律可视化足够且省电 */
const DEFAULT_FRAME_INTERVAL_MS = 33;
/** 高性能设备（CPU 性能层级 >= 4）才启用 60fps */
const HIGH_FRAME_INTERVAL_MS = 16;
/** CPU 性能层级上限（WICG proposal：1-4） */
const CPU_PERFORMANCE_LEVEL_MAX = 4;

/**
 * WICG CPU Performance API（https://github.com/WICG/cpu-performance）：navigator.cpuPerformance 返回 1-4。
 * 浏览器未实现（undefined / 不支持）时返回 null——生产环境常态，属于渐进增强。
 */
export function cpuPerformanceLevel(): number | null {
  if (typeof navigator === "undefined") {
    return null; // SSR
  }
  const { cpuPerformance } = navigator as Navigator & { cpuPerformance?: number };
  if (typeof cpuPerformance !== "number" || !Number.isInteger(cpuPerformance)) {
    return null;
  }
  if (cpuPerformance < 1 || cpuPerformance > CPU_PERFORMANCE_LEVEL_MAX) {
    return null;
  }
  return cpuPerformance;
}

/** 按性能层级决定可视化帧间隔（ms）：层级 >= 4 → 60fps，否则（含不支持）→ 30fps */
export function visualizerFrameIntervalMs(level: number | null): number {
  return level !== null && level >= CPU_PERFORMANCE_LEVEL_MAX
    ? HIGH_FRAME_INTERVAL_MS
    : DEFAULT_FRAME_INTERVAL_MS;
}

/**
 * 音频可视化（R4 8.6）：WebAudio AnalyserNode 频谱 → canvas 条形图。
 * - 独立组件不污染布局：挂载即运行，卸载（面板折叠/关闭）即停止 rAF
 * - analyser 不可用（SSR/jsdom/无 AudioContext）时静默画空频谱，不报错
 * - canvas 适配 DPR；颜色读主题 token（--primary-color）
 */
export function Visualizer(): JSX.Element {
  const player = usePlayer();
  let canvasEl: HTMLCanvasElement | undefined;

  onMount(() => {
    const canvas = canvasEl;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    // DPR 适配：物理像素 = CSS 尺寸 × devicePixelRatio
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = CSS_WIDTH * dpr;
    canvas.height = CSS_HEIGHT * dpr;
    canvas.style.width = `${CSS_WIDTH}px`;
    canvas.style.height = `${CSS_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    let analyser = player.getAnalyser();
    let binCount = analyser?.frequencyBinCount ?? BAR_COUNT;
    let data = new Uint8Array(binCount);
    const color =
      getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim() ||
      "#0a7426";

    const draw = (): void => {
      ctx.clearRect(0, 0, CSS_WIDTH, CSS_HEIGHT);
      ctx.fillStyle = color;
      const barWidth = CSS_WIDTH / BAR_COUNT;
      for (let i = 0; i < BAR_COUNT; i++) {
        // 无 analyser 时 data 恒 0 → 空频谱占位（不报错）
        const value = data[Math.floor((i * binCount) / BAR_COUNT)] ?? 0;
        const barHeight = (value / 255) * CSS_HEIGHT;
        ctx.fillRect(i * barWidth, CSS_HEIGHT - barHeight, barWidth - 1, barHeight);
      }
    };

    let rafId = 0;
    let last = 0;
    const frameInterval = visualizerFrameIntervalMs(cpuPerformanceLevel());
    const loop = (time: number): void => {
      rafId = requestAnimationFrame(loop);
      if (time - last < frameInterval) {
        return;
      }
      last = time;
      // 同源音频在 Visualizer 挂载时 src 尚未就绪（meting 异步），需每帧重新探测以捕获迟到的 AnalyserNode
      const current = player.getAnalyser();
      if (current !== analyser) {
        analyser = current;
        binCount = analyser?.frequencyBinCount ?? BAR_COUNT;
        data = new Uint8Array(binCount);
      }
      if (analyser) {
        analyser.getByteFrequencyData(data);
      }
      draw();
    };
    rafId = requestAnimationFrame(loop);
    onCleanup(() => cancelAnimationFrame(rafId));
  });

  return (
    <canvas
      ref={(el) => {
        canvasEl = el;
      }}
      class="nyx-visualizer mx-auto block"
      aria-label="音频可视化"
      data-testid="visualizer"
    />
  );
}
