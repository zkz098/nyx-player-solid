import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { usePlayer } from "../store";
import { useCurrentSong } from "./useCurrentSong";

/** 唱片封面 + 唱针（原版 AudioCover.vue；旋转由 playing 驱动，切歌时封面重建触发淡入） */
export function AudioCover(): JSX.Element {
  const { state } = usePlayer();
  const song = useCurrentSong();
  const pic = () => song()?.pic ?? "";

  return (
    <div
      class="cover relative flex flex-shrink-0 cursor-pointer items-center justify-center"
      classList={{ playing: state.playing }}
    >
      <div class="disc relative max-h-48 max-w-48 p-6">
        <Show
          keyed
          when={pic()}
          fallback={<div class="cover-placeholder h-6rem w-6rem rounded-50%" />}
        >
          {(src) => (
            <div class="cover-blur-in h-6rem w-6rem overflow-hidden rounded-50%">
              <img src={src} alt="音乐封面" class="max-h-full max-w-full" />
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
