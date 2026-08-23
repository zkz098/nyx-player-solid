// NyxPlayer Solid 演示数据 —— 修改此文件可自定义演示歌曲列表
// 重新执行 `pnpm docs:build`（或 `pnpm docs:demo`）后生效。
// 第一个歌单走直链（无网络可用）；第二个为网易云测试歌单（经 meting 解析，需网络）。
window.DEMO_URLS = [
  {
    name: "demo",
    songs: [
      {
        name: "示例音频 1",
        artist: "SoundHelix",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
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
    url: "https://music.163.com/m/playlist?id=12834717281&creatorId=12676493230",
  },
];