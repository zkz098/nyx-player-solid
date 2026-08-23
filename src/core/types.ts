/**
 * 框架无关的领域类型 —— core 层对外契约。
 * 本文件不得依赖 solid-js / 任何 DOM API。
 */

/** 单个歌曲条目（由 MetadataProvider 产出，播放器直接消费） */
export interface Song {
  /** 歌曲名 */
  name: string;
  /** 歌手 / 艺术家 */
  artist: string;
  /** 音频直链 */
  url: string;
  /** 封面图 URL */
  pic: string;
  /** 歌词资源（LRC 文本或 LRC 文本地址） */
  lrc: string;
}

/** 播放模式状态机（与 UI 按钮循环对应） */
export type PlayMode = "order" | "random" | "loop";

/** 用户给出的歌单来源：URL 歌单 或 直链歌曲列表，二选一 */
export interface PlaylistSource {
  /** 歌单展示名 */
  name: string;
  /** 歌单 URL（网易云 / QQ 音乐等，走 URL 解析） */
  url?: string;
  /** 直链歌曲列表（不走解析，直接播放） */
  songs?: Song[];
}

/** 解析后的歌单 URL 定位 */
export interface AccessibleURL {
  id: string;
  provider: "netease" | "tencent";
  type: "song" | "album" | "artist" | "playlist";
}

/** 歌词行（LRC 解析产物） */
export interface LyricLine {
  /** 歌词文本 */
  text: string;
  /** 开始时间（秒） */
  start: number;
  /** 结束时间（秒，下一行开始前；最后一行 +Infinity） */
  end: number;
}

/** 卡拉 OK 词级单元（LLRC `<mm:ss.xx>词` 结构） */
export interface WordLyricWord {
  /** 词文本 */
  text: string;
  /** 词开始时间（秒） */
  start: number;
  /** 词结束时间（秒，下一词开始前；行末词为行 end） */
  end: number;
}

/** 带词级时间戳的歌词行（extends LyricLine：行级 start/end 语义与 findActiveLyricIndex 兼容） */
export interface WordLyricLine extends LyricLine {
  /** 词序列；无词级标签的普通行退化为 [整行] 单词 */
  words: WordLyricWord[];
}

/** 元数据 Provider：把歌单来源解析为可播放歌曲列表 */
export interface MetadataProvider {
  /** 唯一的 provider 标识 */
  readonly name: string;
  /** 是否可处理该歌单来源 */
  match(source: PlaylistSource): boolean;
  /** 拉取歌曲列表（失败应抛出带可读信息的 Error） */
  fetchSongs(source: PlaylistSource): Promise<Song[]>;
}
