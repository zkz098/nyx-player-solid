import type { MetadataProvider, PlaylistSource } from "../types";

/**
 * 组合 provider：按注册顺序，第一个 match 的 provider 负责解析。
 * 默认注册 [direct, meting]，页面可自定义顺序或追加新 provider。
 */
export function createCompositeProvider(providers: MetadataProvider[]): MetadataProvider {
  return {
    name: "composite",
    match: (source) => providers.some((provider) => provider.match(source)),
    async fetchSongs(source: PlaylistSource) {
      for (const provider of providers) {
        if (provider.match(source)) {
          return provider.fetchSongs(source);
        }
      }
      throw new Error(`No provider matched source: ${source.name}`);
    },
  };
}
