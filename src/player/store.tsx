import type { Store } from "solid-js/store";
import { createStore } from "solid-js/store";
import type { JSX } from "solid-js";
import { createContext, onCleanup, useContext } from "solid-js";
import type {
  AudioAdapter,
  HistoryEntry,
  MetadataProvider,
  PlayMode,
  PlaylistSource,
  PlayerState,
} from "../core";
import { PlayerCore } from "../core";

const PERSIST_KEY = "nyx-player-solid:state";
const SAVE_DEBOUNCE_MS = 300;

/** 持久化白名单：歌单内容不落盘，仅播放现场（R2 决策：字段子集 + 适配器 + debounce） */
export interface PersistedPlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  mode: PlayMode;
  playlistIndex: number;
  perSongIndex: number[];
  perLastIndex: number[];
  volume: number;
  muted: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlayerStoreOptions {
  /** 歌单来源列表 */
  sources: PlaylistSource[];
  /** 音频适配器（默认 HTMLAudioAdapter；测试/自定义传 fake 或复用元素） */
  adapter?: AudioAdapter;
  /** 元数据 provider（默认 composite = direct + meting） */
  provider?: MetadataProvider;
  /** storage 适配器（默认 sessionStorage；传 null 表示不持久化） */
  storage?: StorageLike | null;
  initialMode?: PlayMode;
  initialVolume?: number;
}

export interface PlayerStore {
  /** Solid store：细粒度订阅（读取 state.xxx 只随 xxx 变化重算） */
  state: Store<PlayerState>;
  core: PlayerCore;
  /** 并发拉取歌单 + 应用持久化恢复（须在挂载后调用一次；SSR 环境不执行） */
  init(): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(time: number): void;
  setMode(mode: PlayMode): void;
  cycleMode(): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  selectPlaylist(index: number): void;
  playSong(playlistIndex: number, songIndex: number): void;
  /** 播放历史：后退 / 前进 / 清空 / 读取 */
  back(): void;
  forward(): void;
  clearHistory(): void;
  getHistory(): HistoryEntry[];
  /** 音频分析节点（无支持环境返回 null） */
  getAnalyser(): AnalyserNode | null;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null; // SSR / 无 storage 环境
  }
}

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: TArgs) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), ms);
  };
}

function pickPersisted(state: PlayerState): PersistedPlayerState {
  return {
    playing: state.playing,
    currentTime: state.currentTime,
    duration: state.duration,
    mode: state.mode,
    playlistIndex: state.playlistIndex,
    perSongIndex: state.perSongIndex,
    perLastIndex: state.perLastIndex,
    volume: state.volume,
    muted: state.muted,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeIndexes(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => num(item)) : [];
}

function modeOf(value: unknown): PlayMode {
  if (value === "random" || value === "loop") {
    return value;
  }
  return "order";
}

function parsePersisted(raw: string | null): PersistedPlayerState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    return {
      playing: parsed.playing === true,
      currentTime: num(parsed.currentTime),
      duration: num(parsed.duration),
      mode: modeOf(parsed.mode),
      playlistIndex: num(parsed.playlistIndex),
      perSongIndex: normalizeIndexes(parsed.perSongIndex),
      perLastIndex: normalizeIndexes(parsed.perLastIndex),
      volume: num(parsed.volume),
      muted: parsed.muted === true,
    };
  } catch {
    return null;
  }
}

/** 创建播放器实例（工厂 + Context 注入，多实例隔离；R2 决策） */
export function createPlayerStore(options: PlayerStoreOptions): PlayerStore {
  const core = new PlayerCore({
    adapter: options.adapter,
    provider: options.provider,
    initialMode: options.initialMode,
    initialVolume: options.initialVolume,
  });
  const [state, setState] = createStore<PlayerState>(core.getState());
  const unsubscribe = core.subscribe((next) => setState(next));

  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const save = debounce((snapshot: PersistedPlayerState) => {
    storage?.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  }, SAVE_DEBOUNCE_MS);
  const stopPersistence = core.subscribe((next) => save(pickPersisted(next)));

  const flush = (): void => {
    if (storage) {
      storage.setItem(PERSIST_KEY, JSON.stringify(pickPersisted(core.getState())));
    }
  };

  if (typeof window !== "undefined" && storage) {
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  }

  onCleanup(() => {
    if (typeof window !== "undefined" && storage) {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    }
    unsubscribe();
    stopPersistence();
    // flush：确保 debounce 挂起的最后一次状态落盘（避免 dispose 丢状态）
    flush();
    core.dispose();
  });

  async function init(): Promise<void> {
    await core.init(options.sources);
    if (!storage) {
      return;
    }
    const persisted = parsePersisted(storage.getItem(PERSIST_KEY));
    if (!persisted) {
      return;
    }
    // 应用会话级设置（mode/volume/muted）
    core.setMode(persisted.mode);
    core.setVolume(persisted.volume);
    if (persisted.muted && !core.getState().muted) {
      core.toggleMute();
    }
    // 恢复到持久化的歌单/歌曲位置与播放进度（原子恢复，支持自动续播；位置无效则忽略）
    const songs = state.playlists[persisted.playlistIndex];
    const songIndex = persisted.perSongIndex[persisted.playlistIndex];
    if (songs && songIndex !== undefined && songIndex >= 0 && songIndex < songs.length) {
      core.restoreState({
        playlistIndex: persisted.playlistIndex,
        songIndex,
        currentTime: persisted.currentTime,
        duration: persisted.duration,
        playing: persisted.playing,
      });

      // 若原先处于播放态但在新页面被浏览器 Autoplay 策略拦截（playing 回退为 false），注册一次性页面手势自动补播
      if (persisted.playing && typeof document !== "undefined") {
        const onFirstGesture = (): void => {
          if (!core.getState().playing) {
            core.play();
          }
        };
        document.addEventListener("pointerdown", onFirstGesture, { once: true });
        document.addEventListener("keydown", onFirstGesture, { once: true });
      }
    }
  }

  return {
    state,
    core,
    init,
    play: () => core.play(),
    pause: () => core.pause(),
    toggle: () => core.toggle(),
    next: () => core.next(),
    prev: () => core.prev(),
    seek: (time: number) => core.seek(time),
    setMode: (mode: PlayMode) => core.setMode(mode),
    cycleMode: () => core.cycleMode(),
    setVolume: (volume: number) => core.setVolume(volume),
    toggleMute: () => core.toggleMute(),
    selectPlaylist: (index: number) => core.selectPlaylist(index),
    playSong: (playlistIndex: number, songIndex: number) => core.playSong(playlistIndex, songIndex),
    back: () => core.back(),
    forward: () => core.forward(),
    clearHistory: () => core.clearHistory(),
    getHistory: () => core.getHistory(),
    getAnalyser: () => core.getAnalyser(),
  };
}

const PlayerContext = createContext<PlayerStore>();

/** Solid Context Provider（多实例隔离的注入通道） */
export function PlayerProvider(props: { store: PlayerStore; children: JSX.Element }): JSX.Element {
  return <PlayerContext.Provider value={props.store}>{props.children}</PlayerContext.Provider>;
}

/** 消费播放器实例 */
export function usePlayer(): PlayerStore {
  const store = useContext(PlayerContext);
  if (!store) {
    throw new Error("usePlayer must be used within <PlayerProvider>");
  }
  return store;
}
