/**
 * dev 启动器：uno CLI --watch 生成静态工具 CSS（与 build:css 同一提取路径，稳定全量）
 * + vite dev server。规避 uno vite 插件 66.8.1 在 vite8/rolldown 下的注入丢失问题。
 * 用法：pnpm dev（替代原先直接 vite）
 */
import { execSync, spawn } from "node:child_process";
import process from "node:process";

const root = process.cwd();

const UNO_GLOB = ['"src/**/*.{ts,tsx}"', '"preview/**/*.{ts,tsx}"'];
const UNO_OUT = "src/generated-uno.css";

// 关键：先同步生成一次 CSS（确保 vite 首载时文件已稳定），
// 再启动 uno --watch（源码变化才重写，vite 正常 HMR，不会引发整页 reload 竞态）
execSync(["pnpm", "exec", "unocss", ...UNO_GLOB, "-o", UNO_OUT].join(" "), {
  cwd: root,
  shell: true,
  stdio: "inherit",
});

/** uno CLI watch：源码变化 → 重写 src/generated-uno.css（vite 作为普通 CSS 热更） */
const unoArgs = ["exec", "unocss", ...UNO_GLOB, "-o", UNO_OUT, "--watch"];
const uno = spawn("pnpm", unoArgs, { cwd: root, shell: true, stdio: "inherit" });
const vite = spawn("pnpm", ["exec", "vite"], { cwd: root, shell: true, stdio: "inherit" });

/** 退出时清理子进程（Windows 需 taskkill /T 杀进程树） */
const cleanup = () => {
  for (const proc of [vite, uno]) {
    try {
      proc.kill();
    } catch {
      // 忽略
    }
  }
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

uno.on("exit", (code) => {
  console.error(`[dev] unocss --watch 退出(code=${code})`);
  if (code !== 0) {
    cleanup();
  }
});
vite.on("exit", (code) => {
  console.error(`[dev] vite 退出(code=${code})`);
  cleanup();
});
