import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [solid(), UnoCSS()],
  server: {
    port: 5199,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        functions: 85,
        lines: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
