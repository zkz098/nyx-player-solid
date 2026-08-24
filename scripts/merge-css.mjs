// 合并 uno.css（工具类）与 player.css（组件样式）为单一 dist/nyx-player.css
// 消费者零工具链：import 'nyx-player-solid/style' 即可全量样式
import { readFileSync, rmSync, writeFileSync } from "node:fs";

// presetWind4 reset 会输出空值自定义属性（`--un-pan-x: ;`，合法 CSS），
// 但 lightningcss 1.33 的 minifier 解析崩（Unexpected token Semicolon，astro/vite 8 构建时触发）。
// 清理这些空值属性（对渲染无任何影响，且产物更小）。
// 注意：不能直接删除"分号+属性+冒号分号"整段（replace 全局扫描非重叠，
// 相邻空值对 `A: ;B: ;` 匹配 A 时会吞掉 B 的前导分号导致 B 残留）——先删属性本身，再合并多余分号。
function stripEmptyCustomProps(css) {
  return css
    .replace(/--[\w-]+:\s*;/g, "")
    .replace(/;;+/g, ";")
    .replace(/;}/g, "}")
    .replace(/^;/, "");
}

// src/player/player.css 用根绝对路径引用两张封面动画图（`/assets/play_*.avif`，
// 原设计假设消费方自行将 assets 放站点根）。独立发布后消费方（如 Astro 站）不会自动
// 获得这些文件 → 构建期内联为 data-URI，消除对外部文件路径的依赖（合计 ~5KB）。
function inlineCoverAssets(css) {
  const assets = ["play_disc.avif", "play_needle.avif"];
  let out = css;
  for (const name of assets) {
    const data = readFileSync(`public/assets/${name}`).toString("base64");
    out = out.replaceAll(`/assets/${name}`, `data:image/avif;base64,${data}`);
  }
  return out;
}

const uno = stripEmptyCustomProps(readFileSync("dist/uno.css", "utf8"));
const player = inlineCoverAssets(readFileSync("src/player/player.css", "utf8"));
writeFileSync("dist/nyx-player.css", `${uno}\n${player}\n`);
rmSync("dist/uno.css", { force: true }); // 中间产物不入 dist
console.log(
  "merged dist/nyx-player.css",
  (uno.length + player.length) / 1024,
  "KiB",
  "(空值自定义属性已清理 + 封面动画图已内联)",
);
