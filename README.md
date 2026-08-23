# NyxPlayer Solid

简洁美观的 SolidJS 音乐播放器组件库 —— NyxPlayer 的 SolidJS 重构版。

A clean, minimal SolidJS music player component library — a rewrite of NyxPlayer.

- **组件 API + Custom Element 双入口**：Solid 工程 `<NyxPlayer>`，任意页面 `<nyx-player>` 标签
- **框架无关 core**：`PlayerCore` + `AudioAdapter` + 元数据 Provider（direct / meting / composite）
- **SSR 安全**：双构建产物（client DOM + SSR），`renderToString` 零客户端 API 报错
- **主题系统**：token 化 CSS 变量 + `nyx` / `shokax` 预设 + 深色模式自动跟随
- **R4 扩展**：MediaSession、拖拽 seek、音量滑杆、卡拉 OK 逐字歌词、MiniBar、跨歌单连续播放、播放历史、音频可视化
- **零事件总线**：信号 → effect 驱动适配器，多实例隔离

## 文档

完整文档站（中英双语，Astro Starlight）在仓库 `docs/` 目录；本地运行：

```bash
pnpm install
pnpm build        # 播放器 dist 产物（docs demo 页依赖）
pnpm docs:dev     # 文档站开发模式 http://localhost:4321
pnpm docs:build   # 文档站构建 → docs/dist/
```

## 快速开始

```bash
pnpm add nyx-player-solid
```

```tsx
import { NyxPlayer } from "nyx-player-solid";
import "nyx-player-solid/style";

export function Player() {
  return (
    <NyxPlayer
      urls={[
        {
          name: "demo",
          songs: [
            {
              name: "示例音频",
              artist: "demo",
              url: "https://example.com/song.mp3",
              pic: "",
              lrc: "[00:00.00]第一行歌词",
            },
          ],
        },
      ]}
      showBtn="#show"
      playBtn="#play"
      preset="shokax"
    />
  );
}
```

页面提供两个外部按钮（也支持传 `HTMLElement` 或元素函数）：

```html
<button id="show">显示 / 隐藏播放器</button> <button id="play">播放 / 暂停</button>
```

无构建环境用 `<nyx-player>` 自定义元素（详见文档）：

```html
<script type="module" src="https://unpkg.com/nyx-player-solid/custom-element"></script>
<link rel="stylesheet" href="https://unpkg.com/nyx-player-solid/style" />
<nyx-player config='{ "urls": [...], "showBtn": "#show" }'></nyx-player>
```

## 组件 API 速览

| Prop                  | 说明                                            |
| --------------------- | ----------------------------------------------- |
| `urls`                | 歌单来源（URL 歌单 / 直链歌曲）                 |
| `showBtn` / `playBtn` | 页面自定义按钮（selector / element / 函数）     |
| `darkModeTarget`      | `"auto"`（系统）或 CSS 选择器（存在即深色）     |
| `preset`              | 颜色预设：`nyx`（默认）/ `shokax`               |
| `styles`              | 自定义 token 覆盖（深合并）                     |
| `provider`            | 元数据 provider（默认 direct + meting）         |
| `persist`             | 跨页持久化（默认 `sessionStorage`；false 关闭） |
| `mode`                | `"panel"`（默认）/ `"mini"`（MiniBar 浮条）     |

播放历史 / 编程式控制 / 主题 / SSR / 扩展功能等完整参考见[文档站](docs/)或 `TODOS.md`。

## 开发

```bash
pnpm dev            # 播放器 preview (http://localhost:5199)
pnpm test           # 单元测试（Vitest + jsdom）
pnpm test:e2e       # E2E（Playwright，起 dev server）
pnpm lint / check   # oxlint / tsc
pnpm format         # oxfmt
pnpm build          # lib 双产物 + 静态 CSS + types + SSR check
```

工具链基线：`oxlint --type-aware --type-check` / `oxfmt` / `tsc` / `vitest` / `playwright` / `pnpm build`（含 ssr-check）全绿。

## 许可

[AGPL-3.0-or-later](LICENSE)
