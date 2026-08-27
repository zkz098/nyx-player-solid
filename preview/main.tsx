import "../src/generated-uno.css";

import { render } from "solid-js/web";
import { NyxPlayer } from "../src";

const urls = [
  {
    name: "demo",
    songs: [
      {
        name: "示例音频 1（波形演示·同源）",
        artist: "SoundHelix",
        // 同源音频（public/t-rex-roar.mp3）→ CORS 安全，可稳定展示音乐波形
        url: "/t-rex-roar.mp3",
        pic: "https://picsum.photos/seed/nyx-1/300/300",
        lrc: "[00:00.00]第一行歌词\n[00:10.00]第二行歌词\n[00:20.00]第三行歌词",
      },
      {
        name: "示例音频 2（同源）",
        artist: "SoundHelix",
        // 同源本地复用，确保 demo 内所有直链均为同源，避免混播导致的 MediaElementSource 单次创建限制引发的“播一段时间后无声、切歌不恢复”
        url: "/t-rex-roar.mp3",
        pic: "https://picsum.photos/seed/nyx-2/300/300",
        lrc: "[00:05.00]<00:05.00>卡拉 <00:05.50>OK <00:06.00>逐字歌词（同源复用演示）",
      },
    ],
  },
  {
    name: "示例歌单 2",
    songs: [
      {
        name: "示例音频 3（同源）",
        artist: "SoundHelix",
        url: "/t-rex-roar.mp3",
        pic: "https://picsum.photos/seed/nyx-3/300/300",
        lrc: "[00:00.00]歌单 2 歌词第一行",
      },
    ],
  },
];

function toggleTheme(): void {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
}

document.querySelector("#theme")?.addEventListener("click", toggleTheme);

// 支持 ?mode=mini 参数直接渲染 Mini 形态（E2E 用）
const urlMode = new URLSearchParams(window.location.search).get("mode");

render(
  () => (
    <NyxPlayer
      urls={urls}
      showBtn="#show"
      playBtn="#play"
      darkModeTarget="html[data-theme='dark']"
      preset="nyx"
      mode={urlMode === "mini" ? "mini" : undefined}
    />
  ),
  document.querySelector("#app")!,
);
