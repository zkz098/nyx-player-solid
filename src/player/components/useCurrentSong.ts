import { createMemo } from "solid-js";
import type { Song } from "../../core";
import { usePlayer } from "../store";

/** 当前歌曲派生（null 时封面区显示占位） */
export function useCurrentSong(): () => Song | null {
  const { state } = usePlayer();
  return createMemo(() => {
    const songs = state.playlists[state.playlistIndex];
    const index = state.perSongIndex[state.playlistIndex] ?? 0;
    return songs?.[index] ?? null;
  });
}
