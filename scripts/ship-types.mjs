// 把 dist/entries/custom-element.d.ts 平铺到 dist/custom-element.d.ts（与 vite 输出的 custom-element.js 对齐）
import { copyFileSync, existsSync } from "node:fs";

const source = "dist/entries/custom-element.d.ts";
const target = "dist/custom-element.d.ts";
if (!existsSync(source)) {
  console.error("missing", source);
  process.exitCode = 1;
  throw new Error(`missing ${source}`);
}
copyFileSync(source, target);
console.log(`shipped ${target}`);
