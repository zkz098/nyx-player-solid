import { describe, expect, it } from "vitest";
import { clearLyricCache, fetchLyricText, normalizeLyricText } from "../src/core/lyrics-fetch";

const RAW_LRC = "[00:00.000]制作人 : 杨武韬\n[00:00.918] 作词 : 雷十一\n";
const ENVELOPE = `{"code":0,"message":"ok","data":{"lrc":"[00:00.000]制作人 : 杨武韬\\n[00:00.918] 作词 : 雷十一\\n","tlyric":"[00:00.918]Hmm","yrc":""}}`;

describe("normalizeLyricText（现代 meting-api-rs envelope 归一化）", () => {
  it("提取 data.lrc 并还原真实换行（\n 不再是字面 \\n）", () => {
    const out = normalizeLyricText(ENVELOPE);
    expect(out).toBe(RAW_LRC);
  });

  it('兼容 {lrc: "..."} 简易包装', () => {
    expect(normalizeLyricText(JSON.stringify({ lrc: RAW_LRC }))).toBe(RAW_LRC);
  });

  it("纯 LRC 文本原样返回 null（调用方用原文）", () => {
    expect(normalizeLyricText(RAW_LRC)).toBeNull();
    expect(normalizeLyricText("[00:00.00]第一行\n[00:10.00]第二行")).toBeNull();
  });

  it("非法 JSON / 无 lrc 字段返回 null", () => {
    expect(normalizeLyricText("not json at all")).toBeNull();
    expect(normalizeLyricText("{broken")).toBeNull();
    expect(normalizeLyricText(JSON.stringify({ code: 0, data: { tlyric: "x" } }))).toBeNull();
    expect(normalizeLyricText(JSON.stringify([]))).toBeNull();
  });
});

describe("fetchLyricText（URL 源，含 envelope 响应）", () => {
  it("内联文本不触发 fetch", async () => {
    let called = false;
    const out = await fetchLyricText(RAW_LRC, {
      fetchImpl: () => {
        called = true;
        return Promise.reject(new Error("should not fetch"));
      },
    });
    expect(out).toBe(RAW_LRC);
    expect(called).toBe(false);
  });

  it("fetch 拿到 envelope → 返回归一化 LRC 文本（无字面 \\n）", async () => {
    clearLyricCache();
    const out = await fetchLyricText("https://example.test/lyric", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => ENVELOPE,
      }),
    });
    expect(out).toBe(RAW_LRC);
    expect(out).not.toContain("\\n");
    expect(out).toContain("\n");
  });

  it("fetch 拿到纯文本 LRC → 原样返回", async () => {
    clearLyricCache();
    const out = await fetchLyricText("https://example.test/lrc.txt", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => RAW_LRC,
      }),
    });
    expect(out).toBe(RAW_LRC);
  });

  it("HTTP 非 2xx 抛错", async () => {
    clearLyricCache();
    await expect(
      fetchLyricText("https://example.test/lyric", {
        fetchImpl: async () => ({ ok: false, status: 502, text: async () => "" }),
      }),
    ).rejects.toThrow(/HTTP 502/);
  });
});
