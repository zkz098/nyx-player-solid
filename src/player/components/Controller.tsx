import type { JSX } from "solid-js";
import { createMemo } from "solid-js";
import { usePlayer } from "../store";

const MODE_ICONS: Record<string, string> = {
  order: "i-ri:order-play-line",
  random: "i-ri:shuffle-line",
  loop: "i-ri:loop-right-line",
};

/** 播放控制条（原版 5 个纯图标 div 迁移为原生 button，带 aria-label 与键盘可达性） */
export function Controller(): JSX.Element {
  const store = usePlayer();
  const modeIcon = createMemo(() => MODE_ICONS[store.state.mode] ?? MODE_ICONS.order);

  return (
    <div class="controller flex cursor-pointer items-center justify-around text-align-center text-sm">
      <button
        class="mode-btn w-18% text-xl"
        type="button"
        aria-label={`播放模式：${store.state.mode}`}
        onClick={() => store.cycleMode()}
      >
        <span class={modeIcon()} />
      </button>
      <button class="w-18% text-xl" type="button" aria-label="上一首" onClick={() => store.prev()}>
        <span class="i-ri:skip-back-line" />
      </button>
      <button
        class="w-18% text-4xl"
        type="button"
        aria-label={store.state.playing ? "暂停" : "播放"}
        onClick={() => store.toggle()}
      >
        <span class={store.state.playing ? "i-ri:pause-circle-fill" : "i-ri:play-circle-fill"} />
      </button>
      <button class="w-18% text-xl" type="button" aria-label="下一首" onClick={() => store.next()}>
        <span class="i-ri:skip-forward-line" />
      </button>
      <button
        class="w-18% text-xl"
        type="button"
        aria-label={store.state.muted ? "取消静音" : "静音"}
        onClick={() => store.toggleMute()}
      >
        <span class={store.state.muted ? "i-ri:volume-mute-line" : "i-ri:volume-up-line"} />
      </button>
    </div>
  );
}
