import type { JSX } from "solid-js";
import { createMemo, Show } from "solid-js";
import { Lyrics } from "./Lyrics";
import { useCurrentSong } from "./useCurrentSong";

/** 歌曲标题 / 歌手 / 歌词（原版 AudioInfo.vue） */
export function AudioInfo(): JSX.Element {
  const song = useCurrentSong();
  const title = createMemo(() => song()?.name ?? "");
  const artist = createMemo(() => song()?.artist ?? "");

  return (
    <div class="w-full flex flex-col overflow-hidden text-ellipsis">
      <h4 class="m-0 max-h-12 overflow-hidden p-0 text-center text-ellipsis">{title()}</h4>
      <span class="flex justify-center text-3">{artist()}</span>
      <Show when={song() !== null}>
        <Lyrics />
      </Show>
    </div>
  );
}
