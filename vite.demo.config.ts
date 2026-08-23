import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * demo 独立构建：自包含 bundle（solid 内联，不 external），供文档站 demo iframe
 * 在纯静态环境下运行。产物经 scripts/build-demo.mjs 拷入 docs/public/demo/。
 */
export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: "docs/dist-demo",
    emptyOutDir: true,
    lib: {
      entry: "docs/static/demo/main.tsx",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
      },
    },
  },
});
