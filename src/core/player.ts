import type { AudioAdapter } from "./audio-adapter";
import { createHTMLAudioAdapter } from "./audio-adapter";
import { runWithPool } from "./pool";
import { createCompositeProvider } from "./providers/composite";
import { directProvider } from "./providers/direct";
import { createMetingProvider } from "./providers/meting";
import type { MetadataProvider, PlayMode, PlaylistSource, Song } from "./types";

/** 播放器运行时状态（UI 只读，变更一律走 PlayerCore 动作） */
export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  mode: PlayMode;
  /** 各歌单的歌曲列表；加载失败的歌单留空数组（可重试） */
  playlists: Song[][];
  playlistNames: string[];
  playlistIndex: number;
  /** 各歌单内当前歌曲索引（原版 PlayList.index 的等价物） */
  perSongIndex: number[];
  /** 各歌单内上次离开的索引（原版 PlayList.lastIdx，切歌回退用） */
  perLastIndex: number[];
  volume: number;
  muted: boolean;
  loading: boolean;
  error: string | null;
}

export interface PlayerCoreOptions {
  /** 音频适配器（测试注入 fake；默认 HTMLAudioAdapter） */
  adapter?: AudioAdapter;
  /** 元数据 provider（默认 composite = direct + meting） */
  provider?: MetadataProvider;
  initialMode?: PlayMode;
  initialVolume?: number;
}

/** 播放历史条目（R4 8.5：歌曲索引升级为带歌单维度的栈） */
export interface HistoryEntry {
  playlistIndex: number;
  songIndex: number;
}

const INITIAL_STATE: PlayerState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  mode: "order",
  playlists: [],
  playlistNames: [],
  playlistIndex: 0,
  perSongIndex: [],
  perLastIndex: [],
  volume: 1,
  muted: false,
  loading: false,
  error: null,
};

const INIT_LIMIT = 3;

/** 派生：当前歌单里正在播放的歌曲 */
export function currentSongOf(state: PlayerState): Song | null {
  const songs = state.playlists[state.playlistIndex];
  const index = state.perSongIndex[state.playlistIndex] ?? 0;
  return songs?.[index] ?? null;
}

function defaultProvider(): MetadataProvider {
  return createCompositeProvider([directProvider, createMetingProvider()]);
}

/**
 * 框架无关的播放状态机。
 * 设计目的（针对原版）：
 * - 单向数据流：动作 → setState → notify；audio 副作用由本类内聚，UI 无事件总线可漏。
 * - ended/error 显式处理：自动切歌不再依赖 UI 侧 timeupdate >= duration 的 hack。
 * - 可注入 AudioAdapter 与 MetadataProvider：核心全部可单测。
 */
export class PlayerCore {
  private state: PlayerState = { ...INITIAL_STATE, perSongIndex: [], perLastIndex: [] };
  private readonly adapter: AudioAdapter;
  private readonly provider: MetadataProvider;
  private readonly listeners = new Set<(state: PlayerState) => void>();
  private readonly disposers: Array<() => void> = [];
  /** 歌曲索引历史栈（原版 lastIdx 单值升级，R4 8.5 播放历史）。含歌单维度；cursor 指向当前播放条目 */
  private history: HistoryEntry[] = [];
  private historyCursor = -1; // -1 = 尚未初始化（当前播放的是初始歌曲）
  /** 歌单未就绪时点击播放的排队标记（init 完成后自动开始） */
  private pendingPlay = false;

  constructor(options: PlayerCoreOptions = {}) {
    this.adapter = options.adapter ?? createHTMLAudioAdapter();
    this.provider = options.provider ?? defaultProvider();
    if (options.initialMode) {
      this.state.mode = options.initialMode;
    }
    if (options.initialVolume !== undefined) {
      this.state.volume = clampVolume(options.initialVolume);
      this.adapter.setVolume(this.state.volume);
    }
    this.bindAdapterEvents();
  }

  getState(): PlayerState {
    return this.state;
  }

  subscribe(listener: (state: PlayerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 并发拉取所有歌单（单项失败留空占位，不中断整体） */
  async init(sources: PlaylistSource[]): Promise<void> {
    this.setState({ loading: true, error: null });
    this.setState({
      playlists: sources.map(() => []),
      playlistNames: sources.map((source) => source.name),
      perSongIndex: sources.map(() => 0),
      perLastIndex: sources.map(() => 0),
    });

    const results = await runWithPool(sources, INIT_LIMIT, async (source) => {
      const songs = await this.provider.fetchSongs(source);
      return songs;
    });

    const playlists = results.map((result) => (result.status === "fulfilled" ? result.value : []));
    const failed = results.filter((result) => result.status === "rejected").length;
    this.setState({
      playlists,
      loading: false,
      error: failed > 0 ? `${failed} 个歌单加载失败` : null,
    });
    // 歌单就绪后，若曾有排队播放请求则自动开始（初期点播的 0:00/0:00 场景）
    if (this.pendingPlay) {
      this.pendingPlay = false;
      this.play();
    }
  }

  play(): void {
    const songs = this.currentSongs();
    if (songs.length === 0) {
      // 歌单未就绪（init 加载中/失败）：标记待播，init 完成后自动开始；UI 立即反馈播放态
      this.pendingPlay = true;
      this.setState({ playing: true });
      return;
    }
    this.pendingPlay = false;
    // 修复：直接播放（未触发 playSong/selectPlaylist）时 audio.src 为空 → 永不播放。
    // 若当前有歌曲但适配器源不一致，先装载当前歌曲再播。
    const song = currentSongOf(this.state);
    if (song && this.adapter.getSrc?.() !== song.url) {
      this.syncSourceToAdapter();
    }
    this.setState({ playing: true });
    void this.playAudio().catch(() => {
      // autoplay 策略拒绝：静默回退为暂停态，UI 可经此感知
      this.setState({ playing: false, error: null });
    });
  }

  pause(): void {
    this.setState({ playing: false });
    this.adapter.pause();
  }

  toggle(): void {
    if (this.state.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** 切下一首。mode=loop 时等价原版 audio.loop 单曲循环：重播当前曲。
   * mode=order：歌单内末首后跨到下一非空歌单（环形回绕，R4 8.5 跨歌单连续播放）。
   * mode=random：当前歌单内随机。 */
  next(): void {
    const songs = this.currentSongs();
    if (songs.length === 0) {
      return;
    }
    if (this.state.mode === "loop") {
      this.adapter.seek(0);
      void this.playAudio().catch(() => undefined);
      return;
    }
    const current = this.state.perSongIndex[this.state.playlistIndex] ?? 0;
    if (this.state.mode === "random") {
      this.switchSong(this.state.playlistIndex, randomIndex(songs.length));
      return;
    }
    const target = current + 1;
    if (target < songs.length) {
      this.switchSong(this.state.playlistIndex, target);
      return;
    }
    this.advanceToNextPlaylist();
  }

  /** 跨歌单：跳到下一个非空歌单的第一首（环形）；全部为空则原地不动 */
  private advanceToNextPlaylist(): void {
    const count = this.state.playlists.length;
    const start = this.state.playlistIndex;
    for (let step = 1; step <= count; step++) {
      const index = (start + step) % count;
      const songs = this.state.playlists[index];
      if (songs && songs.length > 0) {
        // switchSong 不更新 playlistIndex（同歌单导航不需要），跨歌单必须显式切换
        this.setState({ playlistIndex: index });
        this.switchSong(index, 0);
        return;
      }
    }
  }

  /** 切上一首。非 order 模式支持回退到上次离开的歌曲（原版 lastIdx 语义） */
  prev(): void {
    const songs = this.currentSongs();
    if (songs.length === 0) {
      return;
    }
    const current = this.state.perSongIndex[this.state.playlistIndex] ?? 0;
    const last = this.state.perLastIndex[this.state.playlistIndex] ?? 0;
    if (this.state.mode === "order" || current === last) {
      // 普通前一首（等价原版 getPrevSong：记录 last 后 -1 回绕）
      this.switchSong(this.state.playlistIndex, (current - 1 + songs.length) % songs.length);
    } else {
      // 回到上次离开的歌曲；不更新 last（修复：原实现把 last 覆盖为当前，多步 prev 来回弹跳）
      this.switchSong(this.state.playlistIndex, last, false);
    }
  }

  /** 跳转到目标秒数 */
  seek(time: number): void {
    const clamped = Number.isFinite(time) && time >= 0 ? time : 0;
    this.adapter.seek(clamped);
    this.setState({ currentTime: clamped });
  }

  setMode(mode: PlayMode): void {
    this.setState({ mode });
  }

  /** 循环切换播放模式：order → random → loop → order */
  cycleMode(): void {
    const next =
      this.state.mode === "order" ? "random" : this.state.mode === "random" ? "loop" : "order";
    this.setState({ mode: next });
  }

  setVolume(volume: number): void {
    const clamped = clampVolume(volume);
    this.adapter.setVolume(clamped);
    this.setState({ volume: clamped, muted: clamped === 0 });
  }

  toggleMute(): void {
    const muted = !this.state.muted;
    this.adapter.setMuted(muted);
    this.setState({ muted });
  }

  /** 切换歌单（保持该歌单记忆的歌曲索引） */
  selectPlaylist(index: number): void {
    if (index < 0 || index >= this.state.playlists.length) {
      return;
    }
    this.setState({ playlistIndex: index });
    this.syncSourceToAdapter();
  }

  /** 点击歌单内某首歌：切歌且保持当前播放状态（等价原版 playSong） */
  playSong(playlistIndex: number, songIndex: number): void {
    if (playlistIndex < 0 || playlistIndex >= this.state.playlists.length) {
      return;
    }
    const songs = this.state.playlists[playlistIndex];
    if (!songs || songIndex < 0 || songIndex >= (songs?.length ?? 0)) {
      return;
    }
    this.setState({
      currentTime: 0,
      playlistIndex,
      duration: 0,
    });
    this.switchSong(playlistIndex, songIndex);
  }

  /** MPA 跨页恢复：跳转到持久化保存的进度（当前曲目不同则忽略由调用方判断） */
  restore(time: number): void {
    if (Number.isFinite(time) && time > 0) {
      this.adapter.seek(time);
      this.setState({ currentTime: this.adapter.getCurrentTime() });
    }
  }

  /** 播放历史：后退（回到上一首记录）。无历史可退时不动 */
  back(): void {
    if (this.historyCursor <= 0) {
      return;
    }
    const entry = this.history[this.historyCursor - 1];
    if (!entry) {
      return;
    }
    this.historyCursor -= 1;
    this.gotoHistory(entry);
  }

  /** 播放历史：前进（redo）。无前进分支时不动 */
  forward(): void {
    if (this.historyCursor < 0 || this.historyCursor >= this.history.length - 1) {
      return;
    }
    const entry = this.history[this.historyCursor + 1];
    if (!entry) {
      return;
    }
    this.historyCursor += 1;
    this.gotoHistory(entry);
  }

  /** 清空播放历史（当前歌曲保留） */
  clearHistory(): void {
    this.history = [];
    this.historyCursor = -1;
  }

  /** 当前历史栈（只读，供 UI 展示） */
  getHistory(): HistoryEntry[] {
    return this.history.slice();
  }

  /** 音频分析节点（R4 8.6 可视化透传；适配器未实现/环境不支持返回 null） */
  getAnalyser(): AnalyserNode | null {
    return this.adapter.getContextAnalysis?.() ?? null;
  }

  dispose(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers.length = 0;
    this.adapter.dispose();
    this.listeners.clear();
  }

  // ---- 内部 ----

  private bindAdapterEvents(): void {
    this.disposers.push(
      this.adapter.on("timeupdate", () => {
        this.setState({
          currentTime: this.adapter.getCurrentTime(),
          duration: this.adapter.getDuration() || this.state.duration,
        });
      }),
    );
    this.disposers.push(
      this.adapter.on("loadedmetadata", () => {
        const duration = this.adapter.getDuration();
        if (duration > 0) {
          this.setState({ duration });
        }
      }),
    );
    this.disposers.push(
      this.adapter.on("ended", () => {
        this.handleEnded();
      }),
    );
    this.disposers.push(
      this.adapter.on("error", () => {
        this.setState({ error: `歌曲加载失败: ${currentSongOf(this.state)?.name ?? "unknown"}` });
      }),
    );
  }

  private currentSongs(): Song[] {
    return this.state.playlists[this.state.playlistIndex] ?? [];
  }

  private async playAudio(): Promise<void> {
    await this.adapter.play();
  }

  private handleEnded(): void {
    // 修复原版 bug：自动切歌不再依赖 timeupdate >= duration 的节流 hack
    this.next();
  }

  /**
   * 切换歌曲：记录历史、更新索引、换源；切换后按播放状态续播。
   * @param updateLast 是否把 previous 记为 last（back-to-last 回退场景传 false，保持历史指向不变）
   */
  private switchSong(playlistIndex: number, songIndex: number, updateLast = true): void {
    const songs = this.state.playlists[playlistIndex];
    if (!songs) {
      return;
    }
    const previous = this.state.perSongIndex[playlistIndex] ?? 0;
    const perSongIndex = [...this.state.perSongIndex];
    perSongIndex[playlistIndex] = songIndex;
    const perLastIndex = [...this.state.perLastIndex];
    if (updateLast) {
      perLastIndex[playlistIndex] = previous;
    }
    this.recordHistory(playlistIndex, songIndex);

    const wasPlaying = this.state.playing;
    this.setState({ perSongIndex, perLastIndex, currentTime: 0, duration: 0 });
    this.syncSourceToAdapter();
    if (wasPlaying) {
      void this.playAudio().catch(() => undefined);
    }
  }

  /** 记录播放历史（首次记录包含初始歌曲，使 back 可回到起点；主动导航丢弃 forward 分支） */
  private recordHistory(playlistIndex: number, songIndex: number): void {
    if (this.history.length === 0 && this.historyCursor < 0) {
      this.history.push({ playlistIndex, songIndex: this.state.perSongIndex[playlistIndex] ?? 0 });
      this.historyCursor = 0;
    }
    this.history = this.history.slice(0, this.historyCursor + 1);
    this.history.push({ playlistIndex, songIndex });
    this.historyCursor = this.history.length - 1;
  }

  /** 历史导航：切到目标条目（不更新 last、不记录历史、保持播放状态） */
  private gotoHistory(entry: HistoryEntry): void {
    const songs = this.state.playlists[entry.playlistIndex];
    if (!songs || entry.songIndex < 0 || entry.songIndex >= songs.length) {
      return;
    }
    const wasPlaying = this.state.playing;
    this.setState({
      currentTime: 0,
      duration: 0,
      playlistIndex: entry.playlistIndex,
      perSongIndex: this.withIndex(entry.playlistIndex, entry.songIndex),
    });
    this.syncSourceToAdapter();
    if (wasPlaying) {
      void this.playAudio().catch(() => undefined);
    }
  }

  private withIndex(playlistIndex: number, songIndex: number): number[] {
    const perSongIndex = [...this.state.perSongIndex];
    perSongIndex[playlistIndex] = songIndex;
    return perSongIndex;
  }

  private syncSourceToAdapter(): void {
    const song = currentSongOf(this.state);
    this.adapter.setSrc(song?.url ?? "");
  }

  private setState(partial: Partial<PlayerState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }
  return Math.min(1, Math.max(0, volume));
}
