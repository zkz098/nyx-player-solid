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
  /** 获取 WebAudio 分析节点（R4 8.6 可视化）；环境不支持（SSR/无 AudioContext）返回 null */
  getContextAnalysis?(): AnalyserNode | null;
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

  // ---- R4 8.6 分析链（懒创建，首次 getContextAnalysis 才建 AudioContext） ----
  let analysis: { analyser: AnalyserNode; context: AudioContext } | null = null;

  const getContextAnalysis = (): AnalyserNode | null => {
    if (typeof AudioContext === "undefined") {
      return null;
    }
    if (analysis) {
      return analysis.analyser;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    // createMediaElementSource 接管 audio 输出：必须连回 destination，否则静音
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
    analysis = { analyser, context };
    // 用户手势上下文（播放时）最利于恢复；此处尽力而为
    void context.resume().catch(() => undefined);
    return analyser;
  };

  const resumeAnalysisContext = (): void => {
    if (analysis && analysis.context.state === "suspended") {
      void analysis.context.resume().catch(() => undefined);
    }
  };

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
      resumeAnalysisContext();
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
    getContextAnalysis,
    dispose() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      handlers.clear();
      if (analysis) {
        void analysis.context.close().catch(() => undefined);
        analysis = null;
      }
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
    getContextAnalysis: () => null,
    dispose: () => undefined,
  };
}
