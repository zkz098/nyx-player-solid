/**
 * 音频适配器：把真实音频引擎（HTMLAudioElement 等）抽象为 PlayerCore 可驱动的接口。
 * 首版实现 HTMLAudioAdapter；未来可换 WebAudio / hls 而不动上层。
 * 本文件是唯一允许触摸真实 audio 元素的地方。
 */

export type AudioAdapterEvent =
  | "timeupdate"
  | "ended"
  | "error"
  | "loadedmetadata"
  | "play"
  | "pause";

export interface AudioAdapter {
  /** 切换播放源（不自动播放） */
  setSrc(url: string): void;
  /** 开始播放；受浏览器自动播放策略影响可能被拒绝 */
  play(): Promise<void>;
  /** 暂停 */
  pause(): void;
  /** 跳转到指定秒 */
  seek(time: number): void;
  /** 设置音量（0-1） */
  setVolume(volume: number): void;
  /** 设置静音 */
  setMuted(muted: boolean): void;
  /** 当前进度（秒） */
  getCurrentTime(): number;
  /** 总时长（秒；未加载完可能为 NaN/0/Infinity） */
  getDuration(): number;
  /** 订阅事件，返回取消函数 */
  on(event: AudioAdapterEvent, handler: () => void): () => void;
  /** 释放资源 */
  dispose(): void;
}

/** 创建 HTMLAudioElement 适配器（可注入外部元素，便于 E2E 替换与单例复用） */
export function createHTMLAudioAdapter(element?: HTMLAudioElement): AudioAdapter {
  if (typeof Audio === "undefined") {
    // SSR / 无 Web Audio 环境：no-op 适配器保证组件可渲染，播放动作只在 client 生效
    return createNoopAdapter();
  }
  const audio = element ?? new Audio();
  const handlers = new Map<AudioAdapterEvent, Set<() => void>>();

  const bind = (event: AudioAdapterEvent): void => {
    audio.addEventListener(event, () => {
      handlers.get(event)?.forEach((handler) => handler());
    });
  };
  for (const event of [
    "timeupdate",
    "ended",
    "error",
    "loadedmetadata",
    "play",
    "pause",
  ] as const) {
    bind(event);
  }
  // 方便调试与 SSR 检查
  audio.preload ??= "metadata";

  return {
    setSrc(url) {
      audio.src = url;
      audio.load();
    },
    async play() {
      // play() 返回 Promise，可能被 autoplay 策略拒绝
      await audio.play();
    },
    pause() {
      audio.pause();
    },
    seek(time) {
      if (Number.isFinite(time) && time >= 0) {
        audio.currentTime = time;
      }
    },
    setVolume(volume) {
      audio.volume = volume >= 0 && volume <= 1 ? volume : 0;
    },
    setMuted(muted) {
      audio.muted = muted;
    },
    getCurrentTime() {
      return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    },
    getDuration() {
      return Number.isFinite(audio.duration) ? audio.duration : 0;
    },
    on(event, handler) {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)?.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },
    dispose() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      handlers.clear();
    },
  };
}

/** SSR 安全 no-op 适配器：所有动作无效、事件永不触发 */
export function createNoopAdapter(): AudioAdapter {
  return {
    setSrc: () => undefined,
    async play() {
      // no-op
    },
    pause: () => undefined,
    seek: () => undefined,
    setVolume: () => undefined,
    setMuted: () => undefined,
    getCurrentTime: () => 0,
    getDuration: () => 0,
    on: () => () => undefined,
    dispose: () => undefined,
  };
}
