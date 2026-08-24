import type { JSX } from "solid-js";
import { createMemo, Show } from "solid-js";
import { usePlayer } from "../store";
import { AudioCover } from "./AudioCover";
import { AudioInfo } from "./AudioInfo";
import { Controller } from "./Controller";
import { PlaylistTabs } from "./PlaylistTabs";
import { ProgressBar } from "./ProgressBar";
import { Visualizer } from "./Visualizer";
import "../player.css";

interface PanelProps {
  onClose: () => void;
  /** 面板根元素引用（供外部点击关闭判定） */
  panelRef?: (el: HTMLDivElement | null) => void;
}

/** 播放器面板（对应原版 AudioPlayer.vue；audio 引擎由 PlayerCore+adapter 内部持有，UI 无 <audio> 直接依赖） */
export function Panel(props: PanelProps): JSX.Element {
  const { state } = usePlayer();
  const hasLoaded = createMemo(() => state.playlists.length > 0);

  function toggleOnClose(): void {
    props.onClose();
  }

  return (
    <div
      ref={props.panelRef}
      class="nyx-player panel player-info border-radius-0.8rem fixed z-9 overflow-hidden rounded-xl"
    >
      <Show when={hasLoaded()} fallback={<div class="nyx-loading">加载歌单中…</div>}>
        <div class="preview flex flex-col items-center pb-0 pl-2.5 pr-2.5 pt-5 md:flex-row md:items-center md:pl-5 md:pr-5">
          <AudioCover />
          <AudioInfo />
        </div>
        <Visualizer />
        <ProgressBar />
        <Controller />
        <PlaylistTabs />
        <button
          class="nyx-close absolute right-4 top-3 flex h-8 w-8 cursor-pointer items-center justify-center"
          type="button"
          aria-label="关闭播放器"
          onClick={toggleOnClose}
        >
          <span class="i-ri-close-line text-5" />
        </button>
      </Show>
    </div>
  );
}
