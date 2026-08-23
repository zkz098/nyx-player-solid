import { describe, expect, it } from "vitest";
import { BoundedMap, findActiveLyricIndex, parseLyric, parseLyricLine } from "@/core/lrc";

describe("parseLyricLine", () => {
  it("parses mm:ss.xx (2-digit msec)", () => {
    expect(parseLyricLine("[01:02.50]hello")).toBe(62.5);
  });

  it("parses mm:ss.xxx (3-digit msec)", () => {
    expect(parseLyricLine("[00:30.123]xyz")).toBeCloseTo(30.123);
  });

  it("parses mm:ss", () => {
    expect(parseLyricLine("[00:10]no msec")).toBe(10);
  });

  it("throws on invalid line", () => {
    expect(() => parseLyricLine("no timestamp")).toThrow(/Invalid lyric line/);
  });
});

describe("parseLyric", () => {
  it("builds ordered lines with end boundaries", () => {
    const lyrics = parseLyric("[00:00.00]line1\n[00:05.00]line2");
    expect(lyrics).toHaveLength(2);
    expect(lyrics[0]).toEqual({ text: "line1", start: 0, end: 5 });
    expect(lyrics[1]?.start).toBe(5);
    expect(lyrics[1]?.end).toBe(Infinity);
  });

  it("strips text whitespace after timestamp", () => {
    const parsed = parseLyric("[00:10]  text  ");
    expect(parsed[0]?.text).toBe("text");
  });

  it("throws on metadata header lines (no timestamp) — v0.1 等价行为", () => {
    expect(() => parseLyric("[ar:artist]\n[00:10]text")).toThrow(/Invalid lyric line/);
  });

  it("returns empty array for empty input", () => {
    expect(parseLyric("")).toEqual([]);
  });
});

describe("findActiveLyricIndex", () => {
  const lines = parseLyric("[00:00.00]一\n[00:10.00]二\n[00:20.00]三");

  it("tracks progression of time across lines (原版 lrcIdx 恒 0 bug 回归)", () => {
    expect(findActiveLyricIndex(lines, 0)).toBe(0);
    expect(findActiveLyricIndex(lines, 9.99)).toBe(0);
    expect(findActiveLyricIndex(lines, 10)).toBe(1); // 第二行开始激活
    expect(findActiveLyricIndex(lines, 25)).toBe(2);
  });

  it("falls back to last line when past the end", () => {
    expect(findActiveLyricIndex(lines, 999)).toBe(2);
  });

  it("returns -1 for empty lyrics", () => {
    expect(findActiveLyricIndex([], 5)).toBe(-1);
  });
});

describe("BoundedMap", () => {
  it("evicts oldest key when over capacity", () => {
    const map = new BoundedMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    expect(map.has("a")).toBe(false);
    expect(map.has("b")).toBe(true);
    expect(map.has("c")).toBe(true);
    expect(map.size).toBe(2);
  });
});
