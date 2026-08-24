import { describe, expect, it } from "vitest";
import { createModernMetingProvider } from "../src/core/providers/modern-meting";
import type { PlaylistSource } from "../src/core/types";

type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function mockFetch(data: unknown): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => data });
}

const PLAYLIST_SOURCE: PlaylistSource = {
  name: "netease",
  url: "https://music.163.com/#/playlist?id=12834717281",
};

const PLAYLIST_ENVELOPE = {
  code: 0,
  message: "ok",
  data: {
    id: "12834717281",
    platform: "netease",
    songs: [
      {
        id: "3411999848",
        name: "Two to Tango 交缠舞步",
        artist: ["三Z-STUDIO", "HOYO-MiX"],
        pic_url: "https://p3.music.126.net/xxx.jpg",
        url_id: "3411999848",
        lyric_id: "3411999848",
      },
    ],
  },
};

describe("createModernMetingProvider urlSource", () => {
  it("默认 outer：音频走网易云未登录外链（绕开数据中心 IP 风控）", async () => {
    const provider = createModernMetingProvider({
      baseURL: "https://meting.api.zkz098.cn/",
      fetchImpl: mockFetch(PLAYLIST_ENVELOPE),
    });
    const songs = await provider.fetchSongs(PLAYLIST_SOURCE);
    expect(songs).toHaveLength(1);
    expect(songs[0]?.url).toBe("https://music.163.com/song/media/outer/url?id=3411999848");
    // 歌词仍走 API 代理
    expect(songs[0]?.lrc).toContain("/v1/songs/3411999848/lyric?platform=netease");
    expect(songs[0]?.pic).toContain("500y500");
  });

  it("urlSource=proxy：音频走 API 代理 302（自托管非风控 IP 高码率场景）", async () => {
    const provider = createModernMetingProvider({
      baseURL: "https://your-host",
      urlSource: "proxy",
      fetchImpl: mockFetch(PLAYLIST_ENVELOPE),
    });
    const songs = await provider.fetchSongs(PLAYLIST_SOURCE);
    expect(songs[0]?.url).toBe(
      "https://your-host/v1/songs/3411999848/url?platform=netease&redirect=1",
    );
  });

  it("外层 envelope 与空歌单兼容", async () => {
    const provider = createModernMetingProvider({
      baseURL: "https://meting.api.zkz098.cn/",
      fetchImpl: mockFetch({ code: 0, data: { songs: [] } }),
    });
    const songs = await provider.fetchSongs(PLAYLIST_SOURCE);
    expect(songs).toEqual([]);
  });
});
