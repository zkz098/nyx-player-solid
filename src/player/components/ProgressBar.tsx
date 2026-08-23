import type { JSX } from "solid-js";
import { createSignal } from "solid-js";
import { usePlayer } from "../store";
import { formatTime } from "./format";

/** 进度条（R4 8.2）：pointer 拖拽 seek。拖拽中只显示拖动位置（不写回 currentTime），松手才 store.seek()。 */
export function ProgressBar(): JSX.Element {
  const store = usePlayer();
  const [dragTime, setDragTime] = createSignal<number | null>(null);
  const [dragging, setDragging] = createSignal(false);
  let trackEl: HTMLDivElement | null = null;

  const duration = (): number => (Number.isFinite(store.state.duration) ? store.state.duration : 0);
  const display = (): number => dragTime() ?? store.state.currentTime;
  const ratio = (): number => {
    const total = duration();
    if (total <= 0) {
      return 0;
    }
    const value = Math.min(Math.max(display(), 0), total);
    return value / total;
  };

  function ratioFromEvent(event: PointerEvent): number {
    const el = trackEl;
    if (!el) {
      return 0;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }
    const raw = (event.clientX - rect.left) / rect.width;
    return Math.min(Math.max(raw, 0), 1);
  }

  function commitDrag(): void {
    const target = dragTime();
    if (target !== null) {
      store.seek(target);
      setDragTime(null);
      setDragging(false);
    }
  }

  function onPointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
    if (duration() <= 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragTime(ratioFromEvent(event) * duration());
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging()) {
      return;
    }
    setDragTime(ratioFromEvent(event) * duration());
  }

  function onPointerUp(): void {
    commitDrag();
  }

  function onKeyDown(event: KeyboardEvent): void {
    // 键盘辅助（slider 可达性）：左右方向键 ±5s
    const step = 5;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      store.seek(store.state.currentTime + step);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      store.seek(Math.max(0, store.state.currentTime - step));
    }
  }

  return (
    <div
      class="nyx-progress flex items-center gap-2 px-4 py-1"
      classList={{ dragging: dragging() }}
    >
      <div
        ref={(el) => {
          trackEl = el;
        }}
        class="nyx-progress-track relative h-1.5 flex-1 rounded-full"
        role="slider"
        aria-label="播放进度"
        aria-valuemin={0}
        aria-valuemax={duration() || 0}
        aria-valuenow={Math.round(display())}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={commitDrag}
        onKeyDown={onKeyDown}
      >
        <div class="nyx-progress-fill" style={{ width: `${ratio() * 100}%` }} />
        <div class="nyx-progress-thumb" style={{ left: `${ratio() * 100}%` }} />
      </div>
      <span class="nyx-time text-3 flex-shrink-0">
        {formatTime(display())} / {formatTime(duration())}
      </span>
    </div>
  );
}
