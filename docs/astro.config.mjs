// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

/** Cloudflare Pages 部署域（构建时可用 CLOUDFLARE_PAGES_URL 覆盖） */
const site =
  process.env.CLOUDFLARE_PAGES_URL ?? "https://nyx-player-solid.pages.dev";

export default defineConfig({
  site,
  output: "static",
  integrations: [
    starlight({
      title: "NyxPlayer Solid",
      description: "NyxPlayer 的 SolidJS 重构版 —— 简洁美观的音乐播放器组件库",
      // 简体中文为 root locale：内容直接放 src/content/docs/（URL 无前缀 /guides/...）
      defaultLocale: "root",
      locales: {
        root: { label: "简体中文", lang: "zh-CN" },
        en: { label: "English", lang: "en" },
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/earendil-works/nyx-player-solid" },
      ],
      sidebar: [
        {
          label: "指南",
          translations: { en: "Guides" },
          items: [
            { label: "快速开始", slug: "guides/quick-start", translations: { en: "Quick Start" } },
            { label: "组件 API", slug: "guides/component-api", translations: { en: "Component API" } },
            { label: "Custom Element", slug: "guides/custom-element", translations: { en: "Custom Element" } },
            { label: "主题定制", slug: "guides/theming", translations: { en: "Theming" } },
            { label: "SSR / 集成", slug: "guides/ssr", translations: { en: "SSR Integration" } },
            { label: "扩展功能", slug: "guides/extend", translations: { en: "Extended Features" } },
            { label: "实时演示", slug: "guides/demo", translations: { en: "Live Demo" } },
            { label: "部署", slug: "guides/deploy", translations: { en: "Deploy" } },
          ],
        },
        {
          label: "参考",
          translations: { en: "Reference" },
          items: [
            { label: "Core API", slug: "reference/core-api", translations: { en: "Core API" } },
            { label: "元数据 Provider", slug: "reference/providers", translations: { en: "Metadata Providers" } },
          ],
        },
      ],
    }),
  ],
});