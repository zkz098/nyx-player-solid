import type { JSX } from "solid-js";
import { createMemo } from "solid-js";
import { usePlayer } from "../store";

const MODE_ICONS: Record<string, string> = {
  order: "i-ri:order-play-line",
  random: "i-ri:shuffle-line",
  loop: "i-ri:loop-right-line",
};

/** 导航图标对象值引用（模块图提取对象值稳定，避免静态类漏提） */
const NAV_ICONS = {
  prev: "i-ri:skip-back-line",
  next: "i-ri:skip-forward-line",
} as const;

/** 音量图标：静音 / 0 / 低 / 高 四态 */
function volumeIcon(volume: number, muted: boolean): string {
  if (muted || volume <= 0) {
    return "i-ri:volume-mute-line";
  }
  if (volume < 0.5) {
    return "i-ri:volume-down-line";
  }
  return "i-ri:volume-up-line";
}

/** 播放控制条（原版 5 个纯图标 div 迁移为原生 button；R4 8.2 音量滑杆接入 mute 按钮旁） */
export function Controller(): JSX.Element {
  const store = usePlayer();
  const modeIcon = createMemo(() => MODE_ICONS[store.state.mode] ?? MODE_ICONS.order);
  const icon = createMemo(() => volumeIcon(store.state.volume, store.state.muted));
  const rangeValue = createMemo(() => (store.state.muted ? 0 : store.state.volume));

  return (
    <div class="controller flex cursor-pointer items-center justify-around text-align-center text-sm">
      <button
        class="mode-btn flex-1 text-2xl"
        type="button"
        aria-label={`播放模式：${store.state.mode}`}
        onClick={() => store.cycleMode()}
      >
        <span class={modeIcon()} />
      </button>
      <button
        class="flex-1 text-2xl"
        type="button"
        aria-label="上一首"
        onClick={() => store.prev()}
      >
        <span class={NAV_ICONS.prev} />
      </button>
      <button
        class="flex-1 text-4xl"
        type="button"
        aria-label={store.state.playing ? "暂停" : "播放"}
        onClick={() => store.toggle()}
      >
        <span class={store.state.playing ? "i-ri:pause-circle-fill" : "i-ri:play-circle-fill"} />
      </button>
      <button
        class="flex-1 text-2xl"
        type="button"
        aria-label="下一首"
        onClick={() => store.next()}
      >
        <span class={NAV_ICONS.next} />
      </button>
      <div class="flex flex-[2] items-center justify-around gap-1">
        <button
          class="min-w-9 text-2xl"
          type="button"
          aria-label={store.state.muted ? "取消静音" : "静音"}
          onClick={() => store.toggleMute()}
        >
          <span class={icon()} />
        </button>
        <input
          class="nyx-volume h-1 w-16"
          type="range"
          min={0}
          max={1}
          step={0.01}
          aria-label="音量"
          value={rangeValue()}
          onInput={(event) => store.setVolume(Number(event.currentTarget.value))}
        />
      </div>
    </div>
  );
}
