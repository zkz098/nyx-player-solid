import type { LyricLine } from "./types";

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
