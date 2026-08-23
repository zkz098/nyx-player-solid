// 构建前清空 dist（避免陈旧产物混入）
import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
console.log("cleaned dist");
