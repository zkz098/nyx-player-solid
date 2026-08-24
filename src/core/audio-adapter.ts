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
  /** 当前源 URL（尚未设置返回空串） */
  getSrc?(): string;
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

export interface HTMLAudioAdapterOptions {
  /**
   * 允许发起 CORS 探测的跨域 origin 白名单（默认空 = 不对任何跨域直链接管分析）。
   * 直链（网易云外链/SoundHelix/CDN 等）无 ACAO 头，探测注定失败且浏览器会打 CORS 控制台噪音
   * （fetch ... blocked by CORS policy）——直接按“不允许”处理并返回 null，播放不受影响。
   * 自托管 proxy 场景（自己的 API 域带 ACAO）可视化需传入该 origin。
   */
  probeOrigins?: string[];
}

/** 创建 HTMLAudioElement 适配器（可注入外部元素，便于 E2E 替换与单例复用） */
export function createHTMLAudioAdapter(
  element?: HTMLAudioElement,
  options: HTMLAudioAdapterOptions = {},
): AudioAdapter {
  if (typeof Audio === "undefined") {
    // SSR / 无 Web Audio 环境：no-op 适配器保证组件可渲染，播放动作只在 client 生效
    return createNoopAdapter();
  }
  let audio = element ?? new Audio();
  const handlers = new Map<AudioAdapterEvent, Set<() => void>>();
  let audioListenersBound = false;
  const bindAudioEvents = (target: HTMLAudioElement) => {
    if (audioListenersBound) return;
    audioListenersBound = true;
    for (const event of [
      "timeupdate",
      "ended",
      "error",
      "loadedmetadata",
      "play",
      "pause",
    ] as const) {
      target.addEventListener(event, () => {
        handlers.get(event)?.forEach((handler) => handler());
      });
    }
  };
  const recreateAudioElement = (newSrc?: string): HTMLAudioElement => {
    const old = audio;
    const wasPaused = old.paused;
    const curTime = old.currentTime;
    const vol = old.volume;
    const muted = old.muted;
    const playbackRate = old.playbackRate;
    old.pause();
    old.removeAttribute("src");
    try {
      old.load();
    } catch {}
    audioListenersBound = false;
    const next = new Audio();
    next.volume = vol;
    next.muted = muted;
    next.playbackRate = playbackRate;
    next.preload = "metadata";
    // 保留 crossOrigin 逻辑由 setSrc 统一处理，此处不设置
    bindAudioEvents(next);
    audio = next;
    if (newSrc !== undefined) {
      // 调用方会在外层设置 src，这里仅为重建后立即设置提供便利
      audio.src = newSrc;
    } else if (!wasPaused) {
      // 若重建时原音频在播（极少见），尝试保持时间进度（由调用方决定是否 play）
      try {
        audio.currentTime = curTime;
      } catch {}
    }
    return next;
  };

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
  // MediaElementSource 每个 <audio> 只能创建一次（即使 AudioContext 已 close 仍不可重建），
  // 因此同源↔跨域无 CORS 混播时必须重建 <audio> 才能在后续同源曲上重建分析链，否则“播一段时间后无声、切歌不恢复”
  let hasMediaSource = false;

  const attachAnalysis = (): void => {
    if (chain.analyser || typeof AudioContext === "undefined") {
      return;
    }
    if (hasMediaSource) {
      // 当前 audio 已被旧 AudioContext 占用过 MediaElementSource，需换新元素才能再次创建
      const curSrc = audio.currentSrc || audio.src || "";
      const curTime = audio.currentTime;
      const wasPaused = audio.paused;
      recreateAudioElement(curSrc || undefined);
      // 重建后若原曲在播，需保持进度（setSrc 会在外层重新设置，这里仅恢复时间）
      if (curSrc) {
        try {
          audio.currentTime = curTime;
        } catch {}
        if (!wasPaused) void audio.play().catch(() => undefined);
      }
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    // createMediaElementSource 接管 audio 输出：必须连回 destination，否则静音
    context.createMediaElementSource(audio).connect(analyser);
    analyser.connect(context.destination);
    chain.analyser = analyser;
    chain.context = context;
    hasMediaSource = true;
    void context.resume().catch(() => undefined);
  };

  /** 同源/CORS 允许时立即挂载（MediaElementSource 接管需连回 destination，播放中亦可无缝切换） */
  const maybeAttach = (): void => {
    if (chain.analyser) {
      return;
    }
    attachAnalysis();
  };

  const detachAnalysis = (): void => {
    if (!chain.analyser && !chain.context) return;
    // 关闭 AudioContext 会自动断开 MediaElementSource，避免后续跨域无 CORS 曲目被静音（outputs zeroes）
    // 仅刷新页面才能恢复的“播一段时间后无声、切歌不恢复”即由此引起：同源曲已创建 analyser，后续跨域无 CORS 曲仍走同一 MediaElementSource 导致静音
    void chain.context?.close().catch(() => undefined);
    chain.analyser = null;
    chain.context = null;
    // 不立即重建 <audio>，由下次需要 analyser 的同源曲在 attachAnalysis 时按需重建（避免无谓重建导致当前跨域无 CORS 曲的播放中断）
  };

  /** 跨域源：仅当 origin 在白名单（自己的代理 API，带 ACAO）时才 HEAD 探测；
   *  普通直链（网易云外链/CDN）无 CORS 头，直接判定不允许且不发 fetch（避免无意义探测的 CORS 控制台噪音）。 */
  const probeCrossOrigin = (url: string): void => {
    const origin = originOf(url);
    if (!origin) {
      return;
    }
    if (!(options.probeOrigins ?? []).includes(origin)) {
      // 白名单外跨域直链：无 CORS 头，MediaElementSource 不可用，直接按不允许处理
      corsProbe = { origin, allowed: false };
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
    const url = audio.currentSrc || audio.src || "";
    if (!url) {
      return null;
    }
    const origin = originOf(url);
    const isSameOrigin = !!origin && origin === location.origin;
    if (isSameOrigin) {
      // 同源：无 CORS 限制，安全接管（若之前因跨域无 CORS 已拆链，此处可重建）
      if (!chain.analyser) maybeAttach();
      return chain.analyser;
    }
    // 跨域：需按 origin 粒度判定 CORS
    if (chain.analyser) {
      // 已有同源链但当前切到跨域：若已知该 origin 无 CORS，必须拆链以避免后续整轨静音；否则先拆链并重新探测
      if (corsProbe && corsProbe.origin === origin) {
        if (!corsProbe.allowed) {
          detachAnalysis();
          return null;
        }
        return chain.analyser;
      }
      // 未知 CORS 前，按最安全策略先拆链（避免用旧链播放无 CORS 曲导致静音），随后发起探测
      detachAnalysis();
    }
    probeCrossOrigin(url);
    return chain.analyser;
  };

  const resumeAnalysisContext = (): void => {
    if (chain.context && chain.context.state === "suspended") {
      void chain.context.resume().catch(() => undefined);
    }
  };

  bindAudioEvents(audio);
  // 方便调试与 SSR 检查
  audio.preload ??= "metadata";

  return {
    setSrc(url) {
      // 换源时按新 URL 的 CORS 属性决定分析链去留：
      // - 同源或已知 CORS 允许：保持/重建
      // - 跨域未知或已知不允许：必须拆链，否则后续无 CORS 曲会因复用旧 MediaElementSource 而静音（仅刷新可恢复）
      const newOrigin = originOf(url);
      const isNewSameOrigin = !!newOrigin && newOrigin === location.origin;
      if (!isNewSameOrigin && chain.analyser) {
        if (!corsProbe || corsProbe.origin !== newOrigin) {
          // 未知跨域，先拆链避免静音；探测结果回调中会按需重建
          detachAnalysis();
        } else if (!corsProbe.allowed) {
          detachAnalysis();
        }
      }
      // 换源时机挂载分析链（播放中请求过分析，或探测刚通过）：接管不影响新音轨
      if (pendingAnalysis) {
        attachAnalysis();
        pendingAnalysis = false;
      }
      audio.src = url;
      // 跨域且未设置 crossOrigin 时，浏览器不会发起 CORS 请求；若该 origin 已探测为允许，需带上 anonymous 才能让 MediaElementSource 正常工作
      if (!isNewSameOrigin && corsProbe?.origin === newOrigin && corsProbe.allowed) {
        audio.crossOrigin = "anonymous";
      } else if (isNewSameOrigin) {
        // 同源无需 crossOrigin，保持默认（避免对同源请求附加多余头）
        audio.removeAttribute("crossorigin");
      } else {
        // 未知或不允许的跨域，保持无 crossOrigin 以保证至少可播放（无波形但不静音）
        audio.removeAttribute("crossorigin");
      }
      audio.load();
    },
    getSrc() {
      return audio.src ?? "";
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
    getSrc: () => "",
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
