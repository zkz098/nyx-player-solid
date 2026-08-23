import type { IconifyJSON } from "@iconify/types";
import { defineConfig, presetIcons, presetWind } from "unocss";

export default defineConfig({
  presets: [
    presetWind(),
    presetIcons({
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
