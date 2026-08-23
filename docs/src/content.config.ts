import { defineCollection } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";
import { glob } from "astro/loaders";

/** 文档内容集合（Astro 7 content layer；starlight 样式/结构 schema 由 docsSchema 提供） */
export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
    schema: docsSchema(),
  }),
};