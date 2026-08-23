import { createEffect, createSignal, onCleanup } from "solid-js";

/**
 * 主题系统（R2/R4 决策）：
 * - token 化 CSS 变量，全部标准 CSS 值（原版 alpha()/primaryColor 字符串 hack 已规范化）
 * - 预设与自定义深合并，返回**新对象**（不 mutation 输入；修复原版 Object.assign 写穿问题）
 * - 暗色模式跟随统一：matchMedia(auto) 与 selector(含 MutationObserver) 同一条代码路径
 */

export interface ThemeTokens {
  /** 面板背景 */
  background: string;
  /** 面板边框 */
  border: string;
  /** 关闭按钮颜色 */
  closeBtn: string;
  /** 主文本 */
  primaryText: string;
  /** 次级文本 */
  secondaryText: string;
  /** 播放列表分隔线 */
  playlistLine: string;
  /** 悬停/强调色 */
  hoverBtn: string;
  /** 面板阴影 */
  shadow: string;
  /** 主色（rgb() 形式） */
  primary: string;
  /** 主色 RGB 分量（供 --primary-color-a: rgba(...) 拼接） */
  primaryRgb: string;
}

export interface ThemePreset {
  styles: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
}

const nyxTokens: ThemePreset = {
  styles: {
    light: {
      background: "rgba(253, 253, 253, 0.7)",
      border: "#fdfdfd",
      closeBtn: "#ccc",
      primaryText: "#666",
      secondaryText: "#999",
      playlistLine: "rgba(0, 0, 0, 0.1)",
      hoverBtn: "rgb(10, 116, 38)",
      shadow: "rgba(0, 0, 0, 0.1)",
      primary: "rgb(10, 116, 38)",
      primaryRgb: "10, 116, 38",
    },
    dark: {
      background: "rgba(34, 34, 34, 0.7)",
      border: "#363636",
      closeBtn: "#aaa",
      primaryText: "#aaa",
      secondaryText: "#aaa",
      playlistLine: "rgba(255, 255, 255, 0.1)",
      hoverBtn: "rgb(10, 116, 38)",
      shadow: "rgba(0, 0, 0, 0.3)",
      primary: "rgb(10, 116, 38)",
      primaryRgb: "10, 116, 38",
    },
  },
};

const shokaxTokens: ThemePreset = {
  styles: {
    light: {
      ...nyxTokens.styles.light,
      hoverBtn: "#ed6ea0",
      primary: "rgb(233, 84, 107)",
      primaryRgb: "233, 84, 107",
    },
    dark: {
      ...nyxTokens.styles.dark,
      hoverBtn: "#ed6ea0",
      primary: "rgb(233, 84, 107)",
      primaryRgb: "233, 84, 107",
    },
  },
};

export const presets: Record<string, ThemePreset> = {
  nyx: nyxTokens,
  shokax: shokaxTokens,
};

export const defaultPreset: ThemePreset = nyxTokens;

/** 深合并：返回新对象，绝不修改输入（修复原版 Object.assign 写穿预设/用户 styles） */
export function resolveTheme(options: {
  preset?: string;
  custom?: Partial<ThemePreset>;
}): ThemePreset {
  const base = presets[options.preset ?? ""] ?? defaultPreset;
  const custom = options.custom;
  if (!custom) {
    return base;
  }
  return {
    styles: {
      light: { ...base.styles.light, ...custom.styles?.light },
      dark: { ...base.styles.dark, ...custom.styles?.dark },
    },
  };
}

/** 应用到容器（默认 document.documentElement） */
export function applyThemeTokens(container: HTMLElement, tokens: ThemeTokens): void {
  const style = container.style;
  style.setProperty("--player-background", tokens.background);
  style.setProperty("--player-border", tokens.border);
  style.setProperty("--close-btn", tokens.closeBtn);
  style.setProperty("--primary-text", tokens.primaryText);
  style.setProperty("--secondary-text", tokens.secondaryText);
  style.setProperty("--playlist-line", tokens.playlistLine);
  style.setProperty("--hover-btn", tokens.hoverBtn);
  style.setProperty("--box-bg-shadow", tokens.shadow);
  style.setProperty("--primary-color", tokens.primary);
  style.setProperty("--primary-color-rgb", tokens.primaryRgb);
  style.setProperty("--primary-color-a", `rgba(${tokens.primaryRgb}, 0.3)`);
}

/**
 * 暗色模式目标：
 * - "auto"：跟随系统 prefers-color-scheme
 * - 其它字符串视为 CSS 选择器：目标存在即暗色（旧版语义）
 */
export type DarkModeTarget = string;

/**
 * 暗色模式信号：target 为 "auto" 用 matchMedia；为选择器时监听 documentElement 属性变化（MutationObserver）。
 * 统一返回 light/dark 读写信号（修复原版 selector 模式不响应主题切换）。
 */
export function createDarkModeSignal(target: DarkModeTarget | undefined): () => "light" | "dark" {
  const [mode, setMode] = createSignal<"light" | "dark">(detectInitial(target));

  if (!target) {
    return mode;
  }

  if (target === "auto") {
    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => {
      setMode(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    onCleanup(() => media.removeEventListener("change", onChange));
    return mode;
  }

  // selector 模式：观察 html 的 attribute 变化（博客切换 data-theme 时跟随）
  const query = (): boolean => Boolean(document.querySelector(target));
  setMode(query() ? "dark" : "light");
  const observer = new MutationObserver(() => {
    setMode(query() ? "dark" : "light");
  });
  observer.observe(document.documentElement, { attributes: true });
  onCleanup(() => observer.disconnect());
  return mode;
}

function detectInitial(target: DarkModeTarget | undefined): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light"; // SSR 安全
  }
  if (target === "auto") {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (target && document.querySelector(target)) {
    return "dark";
  }
  return "light";
}

/** 主题应用组合：preset/custom 解析 + 暗色跟随 + CSS 变量注入 */
export function useTheme(options: {
  preset?: string;
  custom?: Partial<ThemePreset>;
  darkModeTarget?: DarkModeTarget;
  container?: () => HTMLElement | null;
}): void {
  const theme = resolveTheme({
    preset: options.preset,
    custom: options.custom,
  });
  const mode = createDarkModeSignal(options.darkModeTarget);

  createEffect(() => {
    const container = options.container?.() ?? document.documentElement;
    const current = mode();
    applyThemeTokens(container, theme.styles[current]);
  });
}
