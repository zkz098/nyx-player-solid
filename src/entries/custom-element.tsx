import type { JSX } from "solid-js";
import { customElement } from "solid-element";
import type { MetadataProvider, PlaylistSource, Song } from "../core";
import { NyxPlayer } from "../player/NyxPlayer";
import type { NyxPlayerProps } from "../player/NyxPlayer";

/**
 * `<nyx-player>` 自定义元素入口（R3 决策：组件 API + custom element 双入口）。
 * 无构建即用：`<script type="module" src="nyx-player-solid/custom-element"></script>`
 * 然后 `<nyx-player config='{...}' />` 或 `.urls` property 赋值。
 * Meta tag 内容为 JSON；复杂值（urls/provider）优先走 property 赋值或 config JSON。
 */

export interface NyxElementProps extends Record<string, unknown> {
  /** JSON 序列化的 PlaylistSource[]（attribute 形式） */
  urls?: string;
  /** JSON 序列化的完整 NyxPlayerProps（优先级高于单项 attribute） */
  config?: string;
  /** 外部按钮 selector（attribute 直接可用） */
  showBtn?: string;
  playBtn?: string;
  darkModeTarget?: string;
  preset?: string;
}

function safeParse(json: string | undefined): unknown {
  if (!json) {
    return undefined;
  }
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strOrUndef(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSongShape(value: unknown): Song | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    name: str(value.name),
    artist: str(value.artist),
    url: str(value.url),
    pic: str(value.pic),
    lrc: str(value.lrc),
  };
}

function toPlaylistSources(value: unknown): PlaylistSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: PlaylistSource[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    out.push({
      name: str(item.name),
      url: strOrUndef(item.url),
      songs: Array.isArray(item.songs)
        ? item.songs.flatMap((song) => {
            const shape = toSongShape(song);
            return shape ? [shape] : [];
          })
        : undefined,
    });
  }
  return out;
}

function resolveProps(props: NyxElementProps): NyxPlayerProps {
  const config = safeParse(props.config);
  if (isRecord(config)) {
    // config JSON 子集：仅暴露常用标量 + urls（styles/provider 走 property 赋值）
    return {
      urls: toPlaylistSources(config.urls),
      showBtn: strOrUndef(config.showBtn),
      playBtn: strOrUndef(config.playBtn),
      darkModeTarget: strOrUndef(config.darkModeTarget),
      preset: strOrUndef(config.preset),
      persist: typeof config.persist === "boolean" ? config.persist : true,
    };
  }
  const urls = safeParse(props.urls);
  return {
    urls: toPlaylistSources(urls),
    showBtn: props.showBtn || undefined,
    playBtn: props.playBtn || undefined,
    darkModeTarget: props.darkModeTarget || undefined,
    preset: props.preset || undefined,
    persist: false,
  };
}

function register(tagName: string): void {
  if (typeof customElements === "undefined") {
    return; // SSR / 无 Web Components 环境：静默跳过（服务端渲染安全）
  }
  customElement(tagName, {}, (props: NyxElementProps): JSX.Element => {
    return <NyxPlayer {...resolveProps(props)} />;
  });
}

/** 手动注册 `<nyx-player>`（幂等；顶层自动注册后一般无需调用） */
export function registerNyxPlayerElement(): void {
  register("nyx-player");
}

export type { MetadataProvider };

// 顶层自动注册：import 'nyx-player-solid/custom-element' 即生效
register("nyx-player");
