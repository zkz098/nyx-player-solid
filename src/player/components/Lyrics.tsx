import { createMemo, createResource, For, Show } from "solid-js";
import type { JSX } from "solid-js";
import { TransitionGroup } from "solid-transition-group";
import type { WordLyricLine } from "../../core";
import { activeWordIndex, fetchLyricText, findActiveLyricIndex, parseWordLyric } from "../../core";
import { usePlayer } from "../store";
import { useCurrentSong } from "./useCurrentSong";
import { formatTime } from "./format";

const WINDOW = 2; // 当前行前后各显示 2 行（共 5 行窗口；active 恒居中）

/**
 * 歌词展示（R4 8.3 增强）：
 * - 行点击 seek：点击任意歌词行跳转到该行开始时间
 * - 卡拉 OK 逐字：LLRC 词级时间戳 → 当前行内逐词点亮（parseWordLyric 兼容纯 LRC）
 * 窗口化渲染：active 行恒居中（自带"滚动高亮"），修复原版 lrcIdx 恒定 bug
 * （findActiveLyricIndex 线性定位，无独立递增状态）。
 */
export function Lyrics(): JSX.Element {
  const player = usePlayer();
  const song = useCurrentSong();

  const lrc = createMemo(() => song()?.lrc ?? "");
  const [data] = createResource<string, string>(lrc, (url) => fetchLyricText(url));
  const lines = createMemo<WordLyricLine[]>(() => {
    const text = data();
    return text ? parseWordLyric(text) : [];
  });

  const activeIndex = createMemo<number>(() =>
    findActiveLyricIndex(lines(), player.state.currentTime),
  );
  const activeWord = createMemo<number>(() => {
    const line = lines()[activeIndex()];
    return line ? activeWordIndex(line.words, player.state.currentTime) : -1;
  });

  const windowLines = createMemo<Array<{ key: number; line: WordLyricLine; current: boolean }>>(
    () => {
      const list = lines();
      const active = activeIndex();
      if (active < 0 || list.length === 0) {
        return [];
      }
      const start = Math.max(0, active - WINDOW);
      const end = Math.min(list.length, active + WINDOW + 1);
      const out: Array<{ key: number; line: WordLyricLine; current: boolean }> = [];
      for (let i = start; i < end; i++) {
        const line = list[i];
        if (line) {
          out.push({ key: i, line, current: i === active });
        }
      }
      return out;
    },
  );

  return (
    <div class="lrc relative mt-1.25 max-h-16 overflow-hidden text-center text-3">
      <Show when={data.loading}>
        <div class="flex justify-center text-3">加载歌词…</div>
      </Show>
      <ul class="p-0">
        <TransitionGroup name="list">
          <For each={windowLines()}>
            {(item) => (
              <li class="list-none" onClick={() => player.seek(item.line.start)}>
                <p
                  classList={{ current: item.current }}
                  title={`跳转到 ${formatTime(item.line.start)}`}
                >
                  <For each={item.line.words}>
                    {(word, wordIndex) => (
                      <span
                        class="word"
                        classList={{ active: item.current && wordIndex() <= activeWord() }}
                      >
                        {word.text}{" "}
                      </span>
                    )}
                  </For>
                </p>
              </li>
            )}
          </For>
        </TransitionGroup>
      </ul>
    </div>
  );
}
