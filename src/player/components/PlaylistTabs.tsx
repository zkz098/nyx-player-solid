import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { usePlayer } from "../store";
import { formatTime } from "./format";

/**
 * 歌单 tabs + 歌曲列表 + 当前曲进度条（原版 PlayListTabs.vue / ListTab.vue 合并迁移）。
 * 进度条仅渲染在当前曲所在行；不可拖拽（拖拽 seek 属 R4 扩展）。
 */
export function PlaylistTabs(): JSX.Element {
  const store = usePlayer();
  const { state } = store;

  function isCurrentRow(playlistIndex: number, songIndex: number): boolean {
    return (
      playlistIndex === state.playlistIndex &&
      songIndex === (state.perSongIndex[playlistIndex] ?? -1)
    );
  }

  function percent(): number {
    if (!state.duration) {
      return 0;
    }
    return Math.min(100, (state.currentTime / state.duration) * 100);
  }

  return (
    <div class="playlist">
      <div class="tabs relative block">
        <div class="nav h-2.6875rem border-b border-[var(--player-border)]">
          <ul class="flex overflow-x-auto whitespace-nowrap p-0">
            <For each={state.playlistNames}>
              {(name, index) => (
                <li
                  class="relative m-0 inline-block cursor-pointer border-none p-0.3125rem-1.25rem"
                  classList={{ active: index() === state.playlistIndex }}
                  data-index={index()}
                  onClick={() => store.selectPlaylist(index())}
                >
                  {name}
                </li>
              )}
            </For>
          </ul>
        </div>

        <Show when={state.playlists[state.playlistIndex]}>
          {(songs) => (
            <ol class="nyx-song-list relative m-0.625rem-0-0 list-none overflow-y-auto p-0.3125rem-0 text-0.8125em">
              <For each={songs()}>
                {(song, songIndex) => (
                  <li
                    class="relative h-2rem flex cursor-pointer overflow-hidden p-0.3125rem-0.9375rem-0.3125rem-1.5625rem hover:bg-[var(--player-background)]"
                    classList={{ current: isCurrentRow(state.playlistIndex, songIndex()) }}
                    onClick={() => store.playSong(state.playlistIndex, songIndex())}
                  >
                    <Show when={isCurrentRow(state.playlistIndex, songIndex())}>
                      <div
                        class="progress absolute left-0 top-0 h-full rounded-0.8125em bg-[var(--primary-color-a)] transition-width duration-250 ease-linear"
                        style={{ width: `${percent()}%` }}
                      >
                        <span class="progress-text absolute right-0 top-0 pr-1 pl-1 text-[var(--secondary-text)]">
                          {formatTime(state.currentTime)} / {formatTime(state.duration)}
                        </span>
                      </div>
                    </Show>
                    <span class="relative z-1 w-full overflow-hidden text-ellipsis">
                      <span class="name float-left">{song.name}</span>
                      <span class="artist float-right ml-0.625rem text-[var(--secondary-text)]">
                        {song.artist}
                      </span>
                    </span>
                  </li>
                )}
              </For>
            </ol>
          )}
        </Show>
      </div>
    </div>
  );
}
