import { createEffect, onCleanup } from "solid-js";
import { currentSongOf } from "../core";
import type { Song } from "../core";
import type { PlayerStore } from "./store";

/**
 * MediaSession 集成（R4 8.1）：
 * - 元数据：title / artist / artwork（← Song.pic）随当前歌曲变化，更新系统媒体中心
 * - Action handlers：play / pause / previoustrack / nexttrack / seekto → PlayerStore 代理
 * - playbackState 同步 playing 信号（锁屏/耳机控制显示）
 * - SSR / 无 mediaSession 环境静默 no-op；session 可注入便于单测
 */

type BoundAction = [MediaSessionAction, MediaSessionActionHandler];

/** 最小 MediaSession 表面（生产传 navigator.mediaSession，测试传 stub） */
export interface MediaSessionLike {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void;
}

/** 取真实 mediaSession；SSR（无 navigator）/ 浏览器无该能力时返回 null */
export function getMediaSession(): MediaSessionLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return navigator.mediaSession ?? null;
}

/** 构造 MediaMetadata；旧浏览器 / 测试环境缺失全局构造器时返回 null（只同步 handlers） */
function toMetadata(song: Song | null): MediaMetadata | null {
  if (typeof MediaMetadata === "undefined") {
    return null;
  }
  if (!song) {
    return null;
  }
  return new MediaMetadata({
    title: song.name,
    artist: song.artist,
    artwork: song.pic ? [{ src: song.pic }] : [],
  });
}

/**
 * 挂载 MediaSession（在 NyxPlayer 内调用；多实例各自接管全局会话，后挂载者生效）。
 * @param session 可注入测试替身；传 undefined 使用 navigator.mediaSession，传 null 强制禁用
 */
export function useMediaSession(store: PlayerStore, session?: MediaSessionLike | null): void {
  const target = session === undefined ? getMediaSession() : session;
  if (!target) {
    return;
  }

  const actions: BoundAction[] = [
    ["play", () => store.play()],
    ["pause", () => store.pause()],
    ["previoustrack", () => store.prev()],
    ["nexttrack", () => store.next()],
    ["seekto", (details) => store.seek(details.seekTime ?? 0)],
  ];
  actions.forEach(([action, handler]) => target.setActionHandler(action, handler));
  onCleanup(() => actions.forEach(([action]) => target.setActionHandler(action, null)));

  // 元数据随当前歌曲变化（细粒度订阅：只读 state）
  createEffect(() => {
    target.metadata = toMetadata(currentSongOf(store.state));
  });

  // 系统媒体中心的播放状态
  createEffect(() => {
    target.playbackState = store.state.playing ? "playing" : "paused";
  });
}
