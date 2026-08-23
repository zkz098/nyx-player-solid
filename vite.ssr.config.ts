import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

/**
 * SSR 构件：generate 'ssr' 编译（无 client template），node/SSR 环境 import 该产物。
 * 与 client lib 产物（dist/nyx-player.js）通过 exports 条件分发：
 *   browser → dist/nyx-player.js | import（node/服务端）→ dist/ssr/index.js
 */
export default defineConfig({
  plugins: [solid({ ssr: true })],
  build: {
    ssr: "src/index.ts",
    outDir: "dist/ssr",
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "solid-js/store"],
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});
