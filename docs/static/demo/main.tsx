import { render } from "solid-js/web";
import type { PlaylistSource } from "../../../src/core";
import { NyxPlayer } from "../../../src/index";

/**
 * demo 页面入口：自包含 bundle（solid 内联，可独立于 npm 环境运行）。
 * 用组件 API 渲染 NyxPlayer；歌曲数据来自 sources.js（window.DEMO_URLS）。
 */
declare global {
  interface Window {
    DEMO_URLS?: PlaylistSource[];
  }
}

const urls = window.DEMO_URLS ?? [];

render(
  () => (
    <NyxPlayer
      urls={urls}
      showBtn="#show"
      playBtn="#play"
      preset="shokax"
      darkModeTarget="auto"
    />
  ),
  document.getElementById("app") as HTMLElement,
);