import type { AccessibleURL, PlaylistSource } from "./types";

interface URLRule {
  pattern: RegExp;
  provider: AccessibleURL["provider"];
  type: AccessibleURL["type"];
}

/**
 * 歌单 URL 解析规则表。
 * 与 v0.1 版规则一致（宽松匹配、无 ^$ 锚定），但改为首个命中即返回（原版 forEach 不 break，
 * 多规则命中时靠后者覆盖，是顺序依赖 bug）。
 */
const RULES: URLRule[] = [
  { pattern: /music\.163\.com.*song.*id=(\d+)/, provider: "netease", type: "song" },
  { pattern: /music\.163\.com.*album.*id=(\d+)/, provider: "netease", type: "album" },
  { pattern: /music\.163\.com.*artist.*id=(\d+)/, provider: "netease", type: "artist" },
  { pattern: /music\.163\.com.*playlist.*id=(\d+)/, provider: "netease", type: "playlist" },
  {
    pattern: /music\.163\.com.*discover\/toplist.*id=(\d+)/,
    provider: "netease",
    type: "playlist",
  },
  // 现代 QQ 音乐 URL（置于旧格式之前，避免旧规则误吃 Detail 后缀）
  { pattern: /y\.qq\.com.*songDetail\/(\w+)(?:\.html)?/, provider: "tencent", type: "song" },
  { pattern: /y\.qq\.com.*albumDetail\/(\w+)(?:\.html)?/, provider: "tencent", type: "album" },
  // 旧格式兼容
  { pattern: /y\.qq\.com.*song\/(\w+)(?:\.html)?/, provider: "tencent", type: "song" },
  { pattern: /y\.qq\.com.*album\/(\w+)(?:\.html)?/, provider: "tencent", type: "album" },
  { pattern: /y\.qq\.com.*singer\/(\w+)(?:\.html)?/, provider: "tencent", type: "artist" },
  { pattern: /y\.qq\.com.*playsquare\/(\w+)(?:\.html)?/, provider: "tencent", type: "playlist" },
  { pattern: /y\.qq\.com.*playlist\/(\w+)(?:\.html)?/, provider: "tencent", type: "playlist" },
];

/** 把歌单 URL 解析为 provider/id/type 定位；无法识别抛出可读错误 */
export function parsePlaylistUrl(url: string): AccessibleURL {
  for (const rule of RULES) {
    const match = rule.pattern.exec(url);
    const id = match?.[1];
    if (id) {
      return { id, provider: rule.provider, type: rule.type };
    }
  }
  throw new Error(`Unsupported URL: ${url}`);
}

/** 判断歌单来源是否需要走 URL 解析（区别于直链 songs） */
export function hasPlaylistURL(source: PlaylistSource): boolean {
  return typeof source.url === "string" && source.url.length > 0;
}
