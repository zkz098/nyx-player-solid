import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    ".playwright-mcp/**",
    "docs/**",
    "node_modules",
  ],
});
