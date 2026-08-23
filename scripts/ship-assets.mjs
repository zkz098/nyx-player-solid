// 拷贝唱片素材到 dist/assets（player.css 用 /assets/*.avif 绝对路径引用）
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist/assets", { recursive: true });
cpSync("public/assets", "dist/assets", { recursive: true });
console.log("copied public/assets → dist/assets");
