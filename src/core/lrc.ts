import type { LyricLine, WordLyricLine, WordLyricWord } from "./types";

/** 解析单行 LRC 的时间戳，返回开始秒数；格式非法抛错 */
export function parseLyricLine(line: string): number {
  const match = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/.exec(line);
  const min = Number.parseInt(match?.[1] ?? "");
  const sec = Number.parseInt(match?.[2] ?? "");
  if (Number.isNaN(min) || Number.isNaN(sec)) {
    throw new Error(`Invalid lyric line format: ${line}`);
  }

  const msecRaw = match?.[3];
  const msec = Number.parseInt(msecRaw ?? "");
  // 2 位毫秒按百分之一秒计，3 位按千分之一秒计
  const msec2sec = msecRaw ? msec / (msecRaw.length === 2 ? 100 : 1000) : 0;
  return min * 60 + sec + msec2sec;
}

/** 词级时间戳（LLRC `<mm:ss.xx>`）：十/百/千分之一秒段位自适应 */
const WORD_TAG_RE = /<(\d{2}):(\d{2})(?:[.,](\d{1,3}))?>(.*?)(?=<\d{2}:\d{2}|$)/g;

function wordSecFromParts(minRaw: string, secRaw: string, msecRaw: string | undefined): number {
  const min = Number.parseInt(minRaw);
  const sec = Number.parseInt(secRaw);
  const msec = Number.parseInt(msecRaw ?? "");
  const digits = msecRaw?.length ?? 0;
  const msec2sec = msecRaw ? msec / (digits === 1 ? 10 : digits === 2 ? 100 : 1000) : 0;
  return min * 60 + sec + msec2sec;
}

/**
 * 解析卡拉 OK 逐字歌词（LLRC：行内 `<mm:ss.xx>词` 词级时间戳）。
 * 兼容性：无词级标签的普通 LRC 行退化为单个整词（words=[整行]），行级语义与 parseLyric 一致。
 */
export function parseWordLyric(lyric: string): WordLyricLine[] {
  const lines = lyric.split("\n").filter(Boolean);
  const parsed = lines.map((line) => {
    const start = parseLyricLine(line);
    const bracketEnd = line.indexOf("]");
    const rawText = bracketEnd !== -1 ? line.substring(bracketEnd + 1).trim() : line.trim();

    const words: WordLyricWord[] = [];
    WORD_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_TAG_RE.exec(rawText)) !== null) {
      const wordText = (match[4] ?? "").trim();
      if (wordText.length === 0) {
        continue;
      }
      words.push({
        text: wordText,
        start: wordSecFromParts(match[1] ?? "", match[2] ?? "", match[3]),
        end: Infinity,
      });
    }

    // 无词级标签：整行作为一个词（普通 LRC 向后兼容）
    let finalWords = words;
    if (finalWords.length === 0) {
      finalWords = rawText.length > 0 ? [{ text: rawText, start, end: Infinity }] : [];
    }
    return { start, text: finalWords.map((w) => w.text).join(" "), words: finalWords };
  });

  return parsed.map((line, i) => {
    const end = i === parsed.length - 1 ? Infinity : (parsed[i + 1]?.start ?? Infinity);
    return {
      text: line.text,
      start: line.start,
      end,
      words: line.words.map((word, wi) => ({
        text: word.text,
        start: word.start,
        end: line.words[wi + 1]?.start ?? end,
      })),
    };
  });
}

/** 卡拉 OK：当前行的活动词索引（最后一个 start <= time 的词；无匹配返回 -1） */
export function activeWordIndex(words: WordLyricWord[], time: number): number {
  let index = -1;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word && word.start <= time) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

/**
 * 解析整段 LRC 文本为有序歌词行；每行 end 取下一行 start（最后一行 +Infinity）。
 * 与 v0.1 版行为一致。
 */
export function parseLyric(lyric: string): LyricLine[] {
  const lines = lyric.split("\n").filter(Boolean);
  const parsed = lines.map((line) => {
    const start = parseLyricLine(line);
    const bracketStart = line.indexOf("[");
    const bracketEnd = line.indexOf("]");
    const text =
      bracketStart !== -1 && bracketEnd !== -1
        ? line.substring(bracketEnd + 1).trim()
        : line.trim();
    return { start, text };
  });

  return parsed.map((line, i) => ({
    text: line.text,
    start: line.start,
    end: i === parsed.length - 1 ? Infinity : (parsed[i + 1]?.start ?? Infinity),
  }));
}

/**
 * 定位当前时间对应的活动歌词行索引（原版 bug：lrcIdx 从不递增 → 此逻辑被组件化地推到 core）。
 * 线性查找 O(n)；无匹配时回退到最后一行（末尾已过），空列表返回 -1。
 */
export function findActiveLyricIndex(lines: LyricLine[], time: number): number {
  if (lines.length === 0) {
    return -1;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && time >= line.start && time < line.end) {
      return i;
    }
  }
  return lines.length - 1;
}

/** 有界 Map：超出上限时淘汰最早插入的键（原版 MaximumMap 迁移，作歌词缓存） */
export class BoundedMap<K, V> extends Map<K, V> {
  readonly maxSize: number;

  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  override set(key: K, value: V): this {
    if (this.size >= this.maxSize) {
      const oldest = this.keys().next();
      if (!oldest.done) {
        this.delete(oldest.value);
      }
    }
    return super.set(key, value);
  }
}
