import type { MetadataProvider, PlaylistSource, Song } from "../types";
import { hasPlaylistURL, parsePlaylistUrl } from "../url-parser";

export interface MetingOptions {
  /** meting API 端点（默认官方公共端点；支持自托管，如 https://your-host/meting/） */
  baseURL?: string;
  /** 单次请求超时（ms，默认 10s） */
  timeoutMs?: number;
  /** 最大重试次数（默认 3，指数退避） */
  maxRetries?: number;
  /** fetch 实现（测试注入；仅要求 ok + status + json 形状，便于 mock） */
  fetchImpl?: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

const DEFAULT_BASE = "https://api.injahow.cn/meting/";
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 3;

/** 类型守卫：对象且非 null（替代 as 断言，满足 no-unsafe-type-assertion） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 运行时防御的字段提取：非字符串一律兜底为空串 */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 升级网易云封面清晰度：90y90 → 500y500（满足 6rem 圆形在 DPR2 下的 192px，且仅 57KB）
 *  - 直链已是 CDN（p*.music.126.net）时直接替换 ?param
 *  - 仍是 meting API 跳转链接（api.injahow.cn/meting/?type=pic）时保持原样，由 AudioCover 在加载后跟随 302 再二次升级（见 AudioCover）
 *  tencent 同理：T002R300x300 → T002R500x500 */
function forceHttps(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

function upgradePic(url: string): string {
  if (!url) return url;
  url = forceHttps(url);
  if (url.includes("music.126.net")) {
    return url.replace(/\?param=\d+y\d+/, "?param=500y500");
  }
  if (url.includes("y.gtimg.cn")) {
    return url.replace(/T002R\d+x\d+M000/, "T002R500x500M000");
  }
  return url;
}

/** 把 meting 响应扁平字段映射为 Song；不做类型断言，缺字段给 "" 兜底 */
function toSong(raw: unknown): Song {
  const item = isRecord(raw) ? raw : {};
  return {
    name: str(item.name),
    artist: str(item.artist),
    url: str(item.url),
    pic: upgradePic(str(item.pic)),
    lrc: str(item.lrc),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 基于 meting 兼容 API 的歌单 provider（原版 fetchPlaylist 迁移；端点可配置、可注入 fetch） */
export function createMetingProvider(options: MetingOptions = {}): MetadataProvider {
  const baseURL = options.baseURL ?? DEFAULT_BASE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    name: "meting",
    match: (source) => hasPlaylistURL(source),
    async fetchSongs(source: PlaylistSource): Promise<Song[]> {
      if (!source.url) {
        throw new Error("meting provider requires a playlist URL");
      }
      const { id, provider, type } = parsePlaylistUrl(source.url);
      const url = `${baseURL}?type=${type}&id=${id}&server=${provider}`;

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const res = await fetchImpl(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} from meting API`);
          }
          const raw: unknown = await res.json();
          if (!Array.isArray(raw)) {
            throw new TypeError("Invalid playlist data received from meting API");
          }
          return raw.map((item) => toSong(item));
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries - 1) {
            // 指数退避：1s / 2s / 4s（封顶 5s）
            await delay(Math.min(1000 * 2 ** attempt, 5000));
          }
        }
      }
      throw new Error(
        `Failed to fetch playlist after ${maxRetries} attempts: ${lastError?.message ?? "unknown"}`,
      );
    },
  };
}
