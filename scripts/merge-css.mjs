// 合并 uno.css（工具类）与 player.css（组件样式）为单一 dist/nyx-player.css
// 消费者零工具链：import 'nyx-player-solid/style' 即可全量样式
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const uno = readFileSync("dist/uno.css", "utf8");
const player = readFileSync("src/player/player.css", "utf8");
writeFileSync("dist/nyx-player.css", `${uno}\n${player}\n`);
rmSync("dist/uno.css", { force: true }); // 中间产物不入 dist
console.log("merged dist/nyx-player.css", uno.length + player.length, "bytes");
