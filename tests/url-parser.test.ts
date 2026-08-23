import { describe, expect, it } from "vitest";
import { parsePlaylistUrl } from "@/core/url-parser";

describe("parsePlaylistUrl", () => {
  it.each([
    ["https://music.163.com/#/song?id=123456", { provider: "netease", type: "song", id: "123456" }],
    ["https://music.163.com/#/album?id=789", { provider: "netease", type: "album", id: "789" }],
    ["https://music.163.com/#/artist?id=42", { provider: "netease", type: "artist", id: "42" }],
    [
      "https://music.163.com/#/playlist?id=2943811283",
      { provider: "netease", type: "playlist", id: "2943811283" },
    ],
    [
      "https://music.163.com/#/discover/toplist?id=3778678",
      { provider: "netease", type: "playlist", id: "3778678" },
    ],
    [
      "https://y.qq.com/n/ryqq/songDetail/003a0VmP2JwT0Y",
      { provider: "tencent", type: "song", id: "003a0VmP2JwT0Y" },
    ],
    [
      "https://y.qq.com/n/ryqq/albumDetail/001D1cVv2g8mTQ",
      { provider: "tencent", type: "album", id: "001D1cVv2g8mTQ" },
    ],
    [
      "https://y.qq.com/song/003a0VmP2JwT0Y.html",
      { provider: "tencent", type: "song", id: "003a0VmP2JwT0Y" },
    ],
    [
      "https://y.qq.com/n/ryqq/singer/000VlRWF2WY6n6",
      { provider: "tencent", type: "artist", id: "000VlRWF2WY6n6" },
    ],
    [
      "https://y.qq.com/n/ryqq/playsquare/7014769926",
      { provider: "tencent", type: "playlist", id: "7014769926" },
    ],
    [
      "https://y.qq.com/n/ryqq/playlist/7014769926",
      { provider: "tencent", type: "playlist", id: "7014769926" },
    ],
  ])("parses %s", (url, expected) => {
    expect(parsePlaylistUrl(url)).toEqual(expected);
  });

  it("rejects unsupported URL", () => {
    expect(() => parsePlaylistUrl("https://example.com/nothing")).toThrow(/Unsupported URL/);
  });

  it("first matching rule wins (no order-dependent override)", () => {
    // 同时含 song 与 playlist 字面：取表序第一个命中（song），修复原版 forEach 不 break 的覆盖问题
    const result = parsePlaylistUrl("https://music.163.com/#/song?id=1&playlist?id=2");
    expect(result.type).toBe("song");
  });
});
