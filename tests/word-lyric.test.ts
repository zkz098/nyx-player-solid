import { describe, expect, it } from "vitest";
import { activeWordIndex, parseWordLyric } from "@/core/lrc";

describe("parseWordLyric（LLRC 词级时间戳解析）", () => {
  it("解析词级标签序列，词 end 衔接下一词 start", () => {
    const lines = parseWordLyric("[00:15.00]<00:15.00>第 <00:15.50>一个 <00:16.00>词");
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line?.start).toBe(15);
    expect(line?.text).toBe("第 一个 词");
    expect(line?.words).toEqual([
      { text: "第", start: 15, end: 15.5 },
      { text: "一个", start: 15.5, end: 16 },
      { text: "词", start: 16, end: Infinity },
    ]);
  });

  it("行 end 取下一行 start；纯 LRC（无词级标签）退化为单个整词", () => {
    const lines = parseWordLyric("[00:00.00]普通歌词行\n[00:10.00]<00:10.00>卡 <00:11.00>拉OK");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.end).toBe(10);
    expect(lines[0]?.words).toEqual([{ text: "普通歌词行", start: 0, end: 10 }]);
    expect(lines[1]?.words).toEqual([
      { text: "卡", start: 10, end: 11 },
      { text: "拉OK", start: 11, end: Infinity },
    ]);
  });

  it("兼容逗号分隔的毫秒与 1-3 位小数", () => {
    const tags = parseWordLyric("[00:00.00]<00:00,5>半 <00:01.25>一又四");
    expect(tags[0]?.words[0]?.start).toBeCloseTo(0.5);
    expect(tags[0]?.words[1]?.start).toBeCloseTo(1.25);
  });

  it("回车过滤空行；空输入返回空数组", () => {
    expect(parseWordLyric("\n\n")).toEqual([]);
    expect(parseWordLyric("")).toEqual([]);
  });

  it("非法行（无行级时间戳）抛错（与 parseLyric 一致）", () => {
    expect(() => parseWordLyric("[ar:artist]\n[00:10]text")).toThrow(/Invalid lyric line/);
  });
});

describe("activeWordIndex（卡拉 OK 词定位）", () => {
  const [line] = parseWordLyric("[00:15.00]<00:15.00>A <00:15.50>B <00:16.00>C");

  it("返回最后一个 start <= time 的词索引", () => {
    expect(activeWordIndex(line?.words ?? [], 14.9)).toBe(-1);
    expect(activeWordIndex(line?.words ?? [], 15)).toBe(0);
    expect(activeWordIndex(line?.words ?? [], 15.49)).toBe(0);
    expect(activeWordIndex(line?.words ?? [], 15.5)).toBe(1);
    expect(activeWordIndex(line?.words ?? [], 20)).toBe(2);
  });

  it("空词列表返回 -1", () => {
    expect(activeWordIndex([], 5)).toBe(-1);
  });
});
