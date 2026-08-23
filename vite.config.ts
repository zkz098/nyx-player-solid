import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [solid(process.env.VITEST ? { hot: false } : undefined), UnoCSS()],
  server: {
    port: 5199,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        "custom-element": "src/entries/custom-element.tsx",
      },
      formats: ["es"],
      cssFileName: "nyx-player",
    },
    rollupOptions: {
      // 框架打入外部（消费者自带 solid）；solid-element 仅 custom-element 入口用到
      external: ["solid-js", "solid-js/web", "solid-js/store", "solid-element"],
      output: {
        entryFileNames: (chunk: { name: string }) =>
          chunk.name === "index" ? "nyx-player.js" : `${chunk.name}.js`,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
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
