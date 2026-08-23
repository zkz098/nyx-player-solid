import { Show } from "solid-js";
import type { JSX } from "solid-js";
import { usePlayer } from "../store";
import { useCurrentSong } from "./useCurrentSong";

interface MiniBarProps {
  /** 展开为完整面板 */
  onExpand: () => void;
  /** 根元素引用（供外部点击关闭判定纳入容器） */
  barRef?: (el: HTMLDivElement | null) => void;
}

/**
 * Mini 形态浮条（R4 8.4，复刻原版 FloatingToolbar）：
 * 小封面 + 标题/歌手 + 播放/暂停 + 展开按钮。固定定位样式随静态 CSS 打包。
 */
export function MiniBar(props: MiniBarProps): JSX.Element {
  const { state } = usePlayer();
  const player = usePlayer();
  const song = useCurrentSong();

  return (
    <div
      ref={props.barRef}
      class="nyx-player nyx-minibar fixed z-9 flex items-center gap-2.5 rounded-full px-3 py-2"
    >
      <div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
        <Show
          keyed
          when={song()?.pic}
          fallback={<div class="nyx-minibar-placeholder h-full w-full" />}
        >
          {(src) => <img src={src} alt="音乐封面" class="h-full w-full object-cover" />}
        </Show>
      </div>
      <div class="flex min-w-0 flex-col justify-center">
        <span class="truncate text-sm leading-tight">{song()?.name ?? "未在播放"}</span>
        <span class="truncate text-xs leading-tight opacity-60">{song()?.artist ?? ""}</span>
      </div>
      <button
        class="text-xl"
        type="button"
        aria-label={state.playing ? "暂停" : "播放"}
        onClick={() => player.toggle()}
      >
        <span class={state.playing ? "i-ri:pause-circle-fill" : "i-ri:play-circle-fill"} />
      </button>
      <button class="text-xl" type="button" aria-label="展开播放器" onClick={props.onExpand}>
        <span class="i-ri:expand-up-line" />
      </button>
    </div>
  );
}
