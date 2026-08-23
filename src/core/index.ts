/**
 * core 层对外入口 —— 框架无关，不得依赖 solid-js / DOM 之外的环境。
 */
export type {
  AccessibleURL,
  LyricLine,
  MetadataProvider,
  PlayMode,
  PlaylistSource,
  Song,
  WordLyricLine,
  WordLyricWord,
} from "./types";

export {
  BoundedMap,
  activeWordIndex,
  findActiveLyricIndex,
  parseLyric,
  parseLyricLine,
  parseWordLyric,
} from "./lrc";
export { fetchLyricText } from "./lyrics-fetch";
export { ConcurrencyPool, runWithPool } from "./pool";
export { hasPlaylistURL, parsePlaylistUrl } from "./url-parser";
export { createMetingProvider } from "./providers/meting";
export type { MetingOptions } from "./providers/meting";
export { directProvider } from "./providers/direct";
export { createCompositeProvider } from "./providers/composite";
export { createHTMLAudioAdapter } from "./audio-adapter";
export type { AudioAdapter, AudioAdapterEvent } from "./audio-adapter";
export { PlayerCore, currentSongOf } from "./player";
export type { HistoryEntry, PlayerCoreOptions, PlayerState } from "./player";
