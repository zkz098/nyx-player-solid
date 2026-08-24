import { BoundedMap } from "./lrc";

export interface LyricFetchOptions {
  /** fetch 实现（测试注入；仅要求 ok + status + text 形状） */
  fetchImpl?: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  /** 单次请求超时（ms，默认 8s） */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 8_000;
/** 有界歌词缓存（原版 MaximumMap(100) 迁移，80 条内） */
const cache = new BoundedMap<string, string>(80);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 把现代 meting-api-rs 的 JSON envelope 归一化为纯 LRC 文本。
 * 兼容形状：
 *  - {"code":0,"message":"ok","data":{"lrc":"[00:00.00]...","tlyric":"...","yrc":"..."}} （/v1/songs/:id/lyric）
 *  - {"lrc":"..."} （简易包装）
 * 非 JSON / 无 lrc 字段一律返回 null（调用方原样使用）。
 * 修复：曾把完整 JSON 原文当作 LRC 解析，JSON 内的换行以字面 \n 出现，导致歌词区显示满屏 \n。
 */
export function normalizeLyricText(text: string): string | null {
  if (!text.trimStart().startsWith("{")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const data = parsed.data;
  const lrc = isRecord(data) ? data.lrc : parsed.lrc;
  if (typeof lrc === "string" && lrc.length > 0) {
    return lrc;
  }
  return null;
}

/** 歌词文本归一化入口：envelope 提取成功用 LRC，否则原文 */
export function normalizeLyricTextOrSelf(text: string): string {
  return normalizeLyricText(text) ?? text;
}

/**
 * 拉取 LRC 文本。Song.lrc 可能是 URL 或内联文本：http(s):// 视为 URL，其余视为已就绪文本。
 * （原版 useFetch 只处理 URL 且缓存混在组件内；这里统一契约进 core 便于单测与 SSR 安全）
 */
export async function fetchLyricText(
  urlOrText: string,
  options: LyricFetchOptions = {},
): Promise<string> {
  if (!/^https?:\/\//.test(urlOrText)) {
    return urlOrText;
  }
  const cached = cache.get(urlOrText);
  if (cached !== undefined) {
    return cached;
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const res = await fetchImpl(urlOrText, {
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT),
  });
  if (!res.ok) {
    throw new Error(`Lyric fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const normalized = normalizeLyricTextOrSelf(text);
  cache.set(urlOrText, normalized);
  return normalized;
}

/** 测试辅助：清空歌词缓存 */
export function clearLyricCache(): void {
  cache.clear();
}
