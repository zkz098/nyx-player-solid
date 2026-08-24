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
        name: "示例音频 2",
        artist: "SoundHelix",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        pic: "https://picsum.photos/seed/nyx-2/300/300",
        lrc: "[00:05.00]<00:05.00>卡拉 <00:05.50>OK <00:06.00>逐字歌词",
      },
    ],
  },
  {
    name: "网易云测试歌单",
    // 之前移除的网易云歌单（文档站 demo 已保留，此处同步恢复；需网络，本地通过 meting 解析）
    url: "https://music.163.com/m/playlist?id=12834717281&creatorId=12676493230",
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
