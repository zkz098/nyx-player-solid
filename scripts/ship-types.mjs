// 把 dist/entries/custom-element.d.ts 平铺到 dist/custom-element.d.ts（与 vite 输出的 custom-element.js 对齐）
// 并生成 dist/style.d.ts（exports[./style] 的 types，供 `import "nyx-player-solid/style"` 类型解析）
import { copyFileSync, existsSync, writeFileSync } from "node:fs";

const source = "dist/entries/custom-element.d.ts";
const target = "dist/custom-element.d.ts";
if (!existsSync(source)) {
  console.error("missing", source);
  process.exitCode = 1;
  throw new Error(`missing ${source}`);
}
copyFileSync(source, target);
console.log(`shipped ${target}`);

writeFileSync("dist/style.d.ts", `declare const css: string\nexport default css\n`, "utf8");
console.log("shipped dist/style.d.ts");
