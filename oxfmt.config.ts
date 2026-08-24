import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".playwright-mcp/**",
    "docs/**",
    "node_modules",
  ],
});
