import type { IconifyJSON } from "@iconify/types";
import { defineConfig, presetIcons, presetWind } from "unocss";

export default defineConfig({
  content: {
    // vite 插件对模块图的零散提取（66.8.1）会漏静态类（如 skip-back-line）：
    // 显式 filesystem glob 全量扫描 src（与 build:css CLI 一致）
    filesystem: ["src/**/*.{ts,tsx}", "preview/**/*.{ts,tsx}"],
    pipeline: {
      include: [/\.(vue|svelte|[jt]sx?|mdx?|astro|[cm]js)$/],
    },
  },
  presets: [
    presetWind(),
    presetIcons({
      // 异步加载图标数据（filesystem glob 已保证 dev 全量提取，异步无碍）
      collections: {
        ri: () =>
          import("@iconify-json/ri/icons.json").then(
            (m) => (m as { default: IconifyJSON }).default,
          ),
      },
      // 修复：icon 类默认 width/height 对 inline 元素不生效 → 渲染尺寸 0×0、按钮塌陷。
      // inline-block 让图标占据 1em 盒子，mask 背景可见。
      extraProperties: { display: "inline-block" },
    }),
  ],
});
