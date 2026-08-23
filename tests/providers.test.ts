import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetingProvider } from "@/core/providers/meting";
import { createCompositeProvider } from "@/core/providers/composite";
import { directProvider } from "@/core/providers/direct";
import type { PlaylistSource, Song } from "@/core/types";

type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const sampleSongs: Song[] = [
  { name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: "" },
  { name: "B", artist: "y", url: "https://b.mp3", pic: "", lrc: "" },
];

/** 构造返回固定 JSON 的 fetch 替身（不触发 no-unsafe-type-assertion） */
function mockFetchOnce(data: unknown): FetchLike {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => data });
}

describe("directProvider", () => {
  it("matches only sources with songs", () => {
    expect(directProvider.match({ name: "x", songs: sampleSongs })).toBe(true);
    expect(directProvider.match({ name: "x", url: "https://music.163.com/#/playlist?id=1" })).toBe(
      false,
    );
  });

  it("returns songs as-is", async () => {
    await expect(directProvider.fetchSongs({ name: "x", songs: sampleSongs })).resolves.toEqual(
      sampleSongs,
    );
  });
});

describe("createMetingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds meting URL from parsed playlist and maps fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          name: "A",
          artist: "x",
          url: "https://a.mp3",
          pic: "https://p.png",
          lrc: "https://l.lrc",
        },
        { name: "B" }, // 缺字段兜底为空串
      ],
    });
    const provider = createMetingProvider({ fetchImpl: fetchMock, maxRetries: 1 });

    const songs = await provider.fetchSongs({
      name: "list",
      url: "https://music.163.com/#/playlist?id=123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.injahow.cn/meting/?type=playlist&id=123&server=netease",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(songs[0]).toEqual({
      name: "A",
      artist: "x",
      url: "https://a.mp3",
      pic: "https://p.png",
      lrc: "https://l.lrc",
    });
    expect(songs[1]).toEqual({ name: "B", artist: "", url: "", pic: "", lrc: "" });
  });

  it("retries on failure then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleSongs,
      });
    const provider = createMetingProvider({ fetchImpl: fetchMock, maxRetries: 2 });

    await expect(
      provider.fetchSongs({ name: "l", url: "https://music.163.com/#/playlist?id=1" }),
    ).resolves.toEqual(sampleSongs);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after max retries with readable error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    const provider = createMetingProvider({ fetchImpl: fetchMock, maxRetries: 2 });

    await expect(
      provider.fetchSongs({ name: "l", url: "https://music.163.com/#/playlist?id=1" }),
    ).rejects.toThrow(/Failed to fetch playlist after 2 attempts: boom/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects non-array response", async () => {
    const provider = createMetingProvider({
      fetchImpl: mockFetchOnce({ not: "an array" }),
      maxRetries: 1,
    });
    await expect(
      provider.fetchSongs({ name: "l", url: "https://music.163.com/#/playlist?id=1" }),
    ).rejects.toThrow(/Invalid playlist data/);
  });

  it("throws readable error for unsupported URL", async () => {
    const provider = createMetingProvider({ maxRetries: 1 });
    await expect(provider.fetchSongs({ name: "l", url: "https://example.com" })).rejects.toThrow(
      /Unsupported URL/,
    );
  });
});

describe("createCompositeProvider", () => {
  it("routes to first matching provider", async () => {
    const direct = directProvider;
    const meting = createMetingProvider({ maxRetries: 1 });
    const composite = createCompositeProvider([direct, meting]);

    const source: PlaylistSource = { name: "direct", songs: sampleSongs };
    expect(composite.match(source)).toBe(true);
    await expect(composite.fetchSongs(source)).resolves.toEqual(sampleSongs);

    const urlSource: PlaylistSource = { name: "url", url: "https://music.163.com/#/playlist?id=1" };
    expect(composite.match(urlSource)).toBe(true);
  });

  it("throws when no provider matches", async () => {
    const composite = createCompositeProvider([directProvider]);
    const empty = { name: "empty", songs: [] };
    expect(composite.match(empty)).toBe(false);
    await expect(composite.fetchSongs(empty)).rejects.toThrow(/No provider matched/);
  });
});
