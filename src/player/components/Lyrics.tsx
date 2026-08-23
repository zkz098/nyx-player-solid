import { createMemo, createResource, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { LyricLine } from "../../core";
import { fetchLyricText, findActiveLyricIndex, parseLyric } from "../../core";
import { usePlayer } from "../store";
import { useCurrentSong } from "./useCurrentSong";

const WINDOW = 2; // 当前行前后各显示 2 行（共 5 行窗口）

/**
 * 歌词展示。修复原版 bug：lrcIdx 从未递增导致高亮恒在第一行。
 * 新版由 currentTime 线性定位活动行（activeIndex 派生，无独立递增状态）。
 */
export function Lyrics(): JSX.Element {
  const { state } = usePlayer();
  const song = useCurrentSong();

  const lrc = createMemo(() => song()?.lrc ?? "");
  const [data] = createResource<string, string>(lrc, (url) => fetchLyricText(url));
  const lines = createMemo<LyricLine[]>(() => {
    const text = data();
    return text ? parseLyric(text) : [];
  });

  const activeIndex = createMemo<number>(() => findActiveLyricIndex(lines(), state.currentTime));

  const windowLines = createMemo<Array<{ key: number; text: string; current: boolean }>>(() => {
    const list = lines();
    const active = activeIndex();
    if (active < 0 || list.length === 0) {
      return [];
    }
    const start = Math.max(0, active - WINDOW);
    const end = Math.min(list.length, active + WINDOW + 1);
    const out: Array<{ key: number; text: string; current: boolean }> = [];
    for (let i = start; i < end; i++) {
      const line = list[i];
      if (line) {
        out.push({ key: i, text: line.text, current: i === active });
      }
    }
    return out;
  });

  return (
    <div class="lrc relative mt-1.25 max-h-16 overflow-hidden text-center text-3">
      <Show when={data.loading}>
        <div class="flex justify-center text-3">加载歌词…</div>
      </Show>
      <ul class="p-0">
        <For each={windowLines()}>
          {(item) => (
            <li class="list-none">
              <p classList={{ current: item.current }}>{item.text || "\u00A0"}</p>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
