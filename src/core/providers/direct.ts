import type { MetadataProvider, PlaylistSource } from "../types";

/**
 * 直链 provider：直接消费 source.songs 数组，不经过任何歌单解析/网络请求。
 * R1 决策：支持自定义 song 列表 / 任意音频 URL（博客挂机、单曲场景）。
 */
export const directProvider: MetadataProvider = {
  name: "direct",
  match: (source) => Boolean(source.songs && source.songs.length > 0),
  async fetchSongs(source: PlaylistSource) {
    return source.songs ?? [];
  },
};
