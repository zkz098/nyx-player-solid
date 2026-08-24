import type { MetadataProvider, PlaylistSource, Song } from "../types";
import { hasPlaylistURL, parsePlaylistUrl } from "../url-parser";

export interface ModernMetingOptions {
  /** 现代 API 根地址（必填；指向 meting-api-rs 部署，如 https://your-host 或 https://your-host/v1） */
  baseURL: string;
  /** 音频 URL 来源：outer=网易云未登录外链（默认，浏览器直连 music.163.com，绕开数据中心 IP 风控）；proxy=经 API 代理 302（自托管非风控 IP 时可拿高码率直链） */
  urlSource?: "outer" | "proxy";
  /** 单次请求超时（ms，默认 10s） */
  timeoutMs?: number;
  /** 最大重试次数（默认 3，指数退避） */
  maxRetries?: number;
  /** fetch 实现（测试注入） */
  fetchImpl?: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 3;

/**
 * 网易云未登录外链接口（YesPlayMusic 同款策略）：用户浏览器直连网易云，
 * 出口 IP 为用户住宅 IP，绕开 CF worker 数据中心出口被网易云 url 接口风控的问题
 * （weapi/eapi 在数据中心 IP 一律 data[0].code=404）。
 * 代价：~128kbps、部分无外链权限的歌返回 HTML 提示页（播放器 error 态提示）。
 */
function outerAudioURL(id: string): string {
  return `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function forceHttps(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

function upgradePic(url: string): string {
  if (!url) return url;
  url = forceHttps(url);
  if (url.includes("music.126.net")) {
    if (/\?param=\d+y\d+/.test(url)) return url.replace(/\?param=\d+y\d+/, "?param=500y500");
    // 无参时直接追加 500y500（现代接口 pic_url 常为裸 CDN）
    return `${url}?param=500y500`;
  }
  if (url.includes("y.gtimg.cn")) {
    if (/T002R\d+x\d+M000/.test(url)) return url.replace(/T002R\d+x\d+M000/, "T002R500x500M000");
    return url;
  }
  return url;
}

function normalizeBase(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 提取现代 API 的 data 字段（兼容 envelope 与裸数组） */
function unwrapData(raw: unknown): unknown {
  if (isRecord(raw) && "data" in raw) {
    return raw.data;
  }
  return raw;
}

/** 提取错误信息（兼容 RFC9457 与 envelope） */
function extractError(raw: unknown): string {
  if (isRecord(raw)) {
    const detail = raw.detail ?? raw.message ?? raw.msg;
    if (isString(detail)) return detail;
    const code = raw.code;
    if (isString(code) && code !== "0") return `code=${code}`;
  }
  try {
    return JSON.stringify(raw).slice(0, 400);
  } catch {
    return String(raw).slice(0, 400);
  }
}

/** 把现代 Song DTO 映射为 nyx Song（懒加载 url/lrc，仅 pic 立即升级） */
function toModernSong(
  raw: unknown,
  apiBase: string,
  provider: string,
  urlKind: "outer" | "proxy",
): Song {
  const item = isRecord(raw) ? raw : {};
  const id = str(item.id) || str(item.url_id) || str(item.lyric_id);
  const name = str(item.name);

  let artist = "";
  const a1 = item.artist;
  const a2 = item.artists;
  if (Array.isArray(a1)) {
    artist = a1.filter(isString).join(" / ");
  } else if (Array.isArray(a2)) {
    // some DTO uses {ar: [{name}]} already mapped, but raw may still have artists
    artist = (a2 as unknown[])
      .map((v) => (isRecord(v) ? str(v.name) : isString(v) ? v : ""))
      .filter(Boolean)
      .join(" / ");
  } else {
    artist = str(a1);
    if (!artist) {
      const ar = item.ar;
      if (Array.isArray(ar)) {
        artist = (ar as unknown[])
          .map((v) => (isRecord(v) ? str(v.name) : ""))
          .filter(Boolean)
          .join(" / ");
      }
    }
  }

  const picRaw = str(item.pic_url) || str(item.pic) || str(item.pic_id) || str(item.picUrl);
  const pic = upgradePic(picRaw);

  // 音频源：outer = 网易云外链直连（默认，用户 IP 不受数据中心风控）；
  // proxy = 走 API 代理 302（自托管在非风控 IP 时可拿 320k 直链）
  const url =
    urlKind === "outer"
      ? outerAudioURL(id)
      : `${apiBase}/songs/${encodeURIComponent(id)}/url?platform=${encodeURIComponent(provider)}&redirect=1`;
  const lrc = `${apiBase}/songs/${encodeURIComponent(id)}/lyric?platform=${encodeURIComponent(provider)}`;

  return { name, artist, url, pic, lrc };
}

/**
 * 现代 meting-api-rs provider（/v1 资源式）。
 *
 * 约定：baseURL 指向 meting-api-rs 根（如 https://your-host 或 https://your-host/v1），
 * 内部自动归一到 .../v1。
 * - playlist: GET /v1/playlists/:id?platform=netease
 * - song:     GET /v1/songs/:id?platform=...
 * - album:    GET /v1/albums/:id (501 则回退为 song)
 * - artist:   GET /v1/artists/:id
 *
 * 返回的 Song url/lrc 为代理 URL（redirect=1），由播放器在需要时跟随 302 到 CDN，
 * 避免歌单加载时 N 次扇出。
 */
export function createModernMetingProvider(options: ModernMetingOptions): MetadataProvider {
  if (!options.baseURL || typeof options.baseURL !== "string") {
    throw new Error("createModernMetingProvider requires baseURL");
  }
  const apiBase = normalizeBase(options.baseURL);
  const urlKind = options.urlSource ?? "outer";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  async function fetchWithRetry(url: string, attemptLabel: string): Promise<unknown> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetchImpl(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as unknown;
          const detail = body ? extractError(body) : `HTTP ${res.status}`;
          throw new Error(`${attemptLabel} failed: ${detail} (HTTP ${res.status})`);
        }
        const raw: unknown = await res.json();
        // 现代 envelope code===0 才算成功；否则抛错触发重试
        if (isRecord(raw) && "code" in raw) {
          const code = raw.code;
          if (code !== 0 && code !== "0") {
            throw new Error(`${attemptLabel} failed: ${extractError(raw)}`);
          }
        }
        return raw;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // 4xx 且非 429/502 不重试？现代 API 400/404 重试无意义，但为保持与 meting.ts 一致仍指数退避
        if (attempt < maxRetries - 1) {
          await delay(Math.min(1000 * 2 ** attempt, 5000));
        }
      }
    }
    throw new Error(
      `Failed to fetch ${attemptLabel} after ${maxRetries} attempts: ${lastError?.message ?? "unknown"}`,
    );
  }

  return {
    name: "modern-meting",
    match: (source) => hasPlaylistURL(source),
    async fetchSongs(source: PlaylistSource): Promise<Song[]> {
      if (!source.url) throw new Error("modern-meting provider requires a playlist URL");
      const { id, provider, type } = parsePlaylistUrl(source.url);

      let rawData: unknown;
      if (type === "playlist") {
        const url = `${apiBase}/playlists/${encodeURIComponent(id)}?platform=${encodeURIComponent(provider)}`;
        const raw = await fetchWithRetry(url, `playlist ${id}`);
        rawData = unwrapData(raw);
        // /v1/playlists/:id 返回 {id, platform, songs: []}
        if (isRecord(rawData) && Array.isArray(rawData.songs)) {
          rawData = rawData.songs;
        }
      } else if (type === "song") {
        const url = `${apiBase}/songs/${encodeURIComponent(id)}?platform=${encodeURIComponent(provider)}`;
        const raw = await fetchWithRetry(url, `song ${id}`);
        rawData = unwrapData(raw);
        rawData = [rawData];
      } else if (type === "album") {
        const url = `${apiBase}/albums/${encodeURIComponent(id)}?platform=${encodeURIComponent(provider)}`;
        const raw = await fetchWithRetry(url, `album ${id}`);
        rawData = unwrapData(raw);
        if (isRecord(rawData) && Array.isArray(rawData.songs)) {
          rawData = rawData.songs;
        } else {
          rawData = [rawData];
        }
      } else if (type === "artist") {
        const url = `${apiBase}/artists/${encodeURIComponent(id)}?platform=${encodeURIComponent(provider)}`;
        const raw = await fetchWithRetry(url, `artist ${id}`);
        rawData = unwrapData(raw);
        if (isRecord(rawData) && Array.isArray(rawData.songs)) {
          rawData = rawData.songs;
        } else if (Array.isArray(rawData)) {
          // keep
        } else {
          rawData = [];
        }
      } else {
        throw new Error(`Unsupported type: ${type}`);
      }

      if (!Array.isArray(rawData)) {
        throw new TypeError(`Invalid data for ${type} ${id}: expected array`);
      }
      // 兼容空歌单
      if (rawData.length === 0) return [];
      return (rawData as unknown[]).map((item) => toModernSong(item, apiBase, provider, urlKind));
    },
  };
}
