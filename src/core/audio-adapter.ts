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

/** 解析 URL origin（SSR / 非法 URL 返回 null） */
function originOf(url: string): string | null {
  try {
    if (typeof location === "undefined") {
      return null;
    }
    return new URL(url, location.href).origin;
  } catch {
    return null;
  }
}

/** 创建 HTMLAudioElement 适配器（可注入外部元素，便于 E2E 替换与单例复用） */
export function createHTMLAudioAdapter(element?: HTMLAudioElement): AudioAdapter {
  if (typeof Audio === "undefined") {
    // SSR / 无 Web Audio 环境：no-op 适配器保证组件可渲染，播放动作只在 client 生效
    return createNoopAdapter();
  }
  const audio = element ?? new Audio();
  const handlers = new Map<AudioAdapterEvent, Set<() => void>>();

  // ---- R4 8.6 分析链（懒创建，CORS 安全接管） ----
  // 关键：MediaElementSourceNode 会接管 audio 输出——对无 CORS 头的跨域源，
  // WebAudio 输出归零（“outputs zeroes due to CORS”）导致整个播放静音。
  // 因此仅对：同源源，或探测到 CORS 允许的跨域源 才接入分析链。
  // 分析链状态（TS 闭包 let 推断 never 问题 → 用对象属性承载；见 chain）
  /** 已请求分析但当前在播放中（避免接管中断播放），等待下次 setSrc 时挂载 */
  let pendingAnalysis = false;
  /** 跨域 CORS 探测结果缓存（按 origin） */
  let corsProbe: { origin: string; allowed: boolean } | null = null;

  // TS 对闭包 let 变量会推断为 never（只有间接赋值），用对象属性承载分析链状态
  const chain = {
    analyser: null as AnalyserNode | null,
    context: null as AudioContext | null,
  };

  const attachAnalysis = (): void => {
    if (chain.analyser || typeof AudioContext === "undefined") {
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    // createMediaElementSource 接管 audio 输出：必须连回 destination，否则静音
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
    chain.analyser = analyser;
    chain.context = context;
    void context.resume().catch(() => undefined);
  };

  /** 空闲才立即挂载；播放中标记 pending 等下次换源（避免中断正在播放的音轨） */
  const maybeAttach = (): void => {
    if (chain.analyser) {
      return;
    }
    if (audio.paused && audio.currentTime === 0) {
      attachAnalysis();
    } else {
      pendingAnalysis = true;
    }
  };

  /** 跨域源：HEAD 探测 CORS 头（mode cors 下无 ACAO 直接 reject，安全判定不可用） */
  const probeCrossOrigin = (url: string): void => {
    const origin = originOf(url);
    if (!origin) {
      return;
    }
    if (corsProbe && corsProbe.origin === origin) {
      if (corsProbe.allowed) {
        maybeAttach();
      }
      return;
    }
    void fetch(url, { mode: "cors", method: "HEAD" })
      .then((res) => {
        corsProbe = {
          origin,
          allowed: res.ok && res.headers.get("access-control-allow-origin") != null,
        };
        if (corsProbe.allowed) {
          maybeAttach();
        }
      })
      .catch(() => {
        corsProbe = { origin, allowed: false };
      });
  };

  const getContextAnalysis = (): AnalyserNode | null => {
    if (typeof AudioContext === "undefined") {
      return null;
    }
    if (chain.analyser) {
      return chain.analyser;
    }
    const url = audio.currentSrc || audio.src || "";
    if (!url) {
      return null;
    }
    const origin = originOf(url);
    if (origin && origin === location.origin) {
      // 同源：无 CORS 限制，安全接管
      maybeAttach();
    } else {
      probeCrossOrigin(url);
    }
    return chain.analyser;
  };

  const resumeAnalysisContext = (): void => {
    if (chain.context && chain.context.state === "suspended") {
      void chain.context.resume().catch(() => undefined);
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
      // 换源时机挂载分析链（播放中请求过分析，或探测刚通过）：接管不影响新音轨
      if (pendingAnalysis) {
        attachAnalysis();
        pendingAnalysis = false;
      }
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
      if (chain.context) {
        void chain.context.close().catch(() => undefined);
        chain.analyser = null;
        chain.context = null;
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
