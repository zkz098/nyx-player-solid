/**
 * 构建 demo 静态目录：
 *   1. vite build（vite.demo.config.ts）→ docs/dist-demo/main.js（自包含 bundle）
 *   2. 拷贝 dist/nyx-player.css → demo 目录（player.css 编译产物）
 *   3. 拷贝 index.html / sources.js（源在 docs/static/demo/）
 *   4. dist/assets（唱片/唱针 avif）→ docs/public/assets（player.css 用 /assets/ 绝对路径）
 * 依赖：先执行 `pnpm build`（生成 dist/nyx-player.css）。
 */
import { execSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const demoSrc = path.join(root, "docs", "static", "demo");
const demoOut = path.join(root, "docs", "public", "demo");
const assetsOut = path.join(root, "docs", "public", "assets");
const distDemo = path.join(root, "docs", "dist-demo");

if (!existsSync(path.join(dist, "nyx-player.css"))) {
  throw new Error(`缺少 dist/nyx-player.css —— 请先执行 \`pnpm build\` 生成核心产物`);
}

// 1) demo 自包含 bundle（solid 内联）
execSync("pnpm exec vite build --config vite.demo.config.ts", {
  cwd: root,
  stdio: "inherit",
});

await rm(demoOut, { recursive: true, force: true });
await mkdir(demoOut, { recursive: true });
await mkdir(assetsOut, { recursive: true });

// 2) 播放器样式 + 3) demo 页面与数据
await Promise.all([
  cp(path.join(dist, "nyx-player.css"), path.join(demoOut, "nyx-player.css")),
  cp(path.join(demoSrc, "index.html"), path.join(demoOut, "index.html")),
  cp(path.join(demoSrc, "sources.js"), path.join(demoOut, "sources.js")),
]);
// demo bundle 产物：只取 main.js（css 由 dist/nyx-player.css 提供）
await cp(path.join(distDemo, "main.js"), path.join(demoOut, "main.js"));
// 4) 唱片/唱针资源 → 站点根 /assets/
if (existsSync(path.join(dist, "assets"))) {
  await cp(path.join(dist, "assets"), assetsOut, { recursive: true });
}

// 清理中间产物
await rm(distDemo, { recursive: true });

console.log(
  "demo built: docs/public/demo/{main.js, nyx-player.css, sources.js, index.html} + public/assets",
);
