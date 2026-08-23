import "../src/generated-uno.css";

import { render } from "solid-js/web";
import { NyxPlayer } from "../src";

const urls = [
  {
    name: "demo",
    songs: [
      {
        name: "示例音频 1",
        artist: "demo",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        pic: "",
        lrc: "[00:00.00]第一行歌词\n[00:10.00]第二行歌词\n[00:20.00]第三行歌词",
      },
      {
        name: "示例音频 2",
        artist: "demo",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        pic: "",
        lrc: "",
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
