/**
 * nyx-player-solid 对外入口。
 * 组件 API（Solid 工程 import）+ core 全套工具 re-export；
 * custom element 入口在 entries/custom-element（交付层）。
 */
export { NyxPlayer } from "./player/NyxPlayer";
export type { NyxPlayerProps } from "./player/NyxPlayer";
export { createPlayerStore, PlayerProvider, usePlayer } from "./player/store";
export type { PlayerStore, PlayerStoreOptions, StorageLike } from "./player/store";
export { useExternalButton } from "./player/external-button";
export type { ExternalButtonRef } from "./player/external-button";
export { applyThemeTokens, presets, resolveTheme, useTheme } from "./player/theme";
export type { DarkModeTarget, ThemePreset, ThemeTokens } from "./player/theme";
export * from "./core";
