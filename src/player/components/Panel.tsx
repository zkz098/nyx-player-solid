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
        <AudioCover />
        <Visualizer />
        <AudioInfo />
        <ProgressBar />
        <Controller />
        <PlaylistTabs />
        <button
          class="absolute right-4 top-3 cursor-pointer text-3.25 hover:color-[var(--hover-btn)]"
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
