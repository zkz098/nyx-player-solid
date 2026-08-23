// 构建产物 SSR 渲染验收：node 直接 import dist/ssr 产物并 renderToString（真实消费者路径）
import { createComponent } from "solid-js";
import { renderToStringAsync } from "solid-js/web";
import { NyxPlayer } from "../dist/ssr/index.js";

const sources = [
  {
    name: "demo",
    songs: [{ name: "A", artist: "x", url: "https://a.mp3", pic: "", lrc: "" }],
  },
];

try {
  const html = await renderToStringAsync(() =>
    createComponent(NyxPlayer, { urls: sources, persist: false }),
  );
  if (typeof html !== "string") {
    throw new Error("renderToStringAsync 未返回字符串");
  }
  console.log(`SSR render OK (${html.length} chars):`, JSON.stringify(html.slice(0, 80)));
  // 面板初始隐藏 → 输出为空字符串或占位，绝不包含崩溃/未定义标记
  if (/undefined|\[object/.test(html)) {
    throw new Error(`SSR 输出含异常标记: ${html.slice(0, 120)}`);
  }
  console.log("SSR check PASSED");
} catch (error) {
  console.error("SSR check FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
