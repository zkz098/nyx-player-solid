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
  cache.set(urlOrText, text);
  return text;
}

/** 测试辅助：清空歌词缓存 */
export function clearLyricCache(): void {
  cache.clear();
}
