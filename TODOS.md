# NyxPlayer Solid — TODO

> 状态时间: 2026-08-23（R4 扩展 8.1-8.7 全部完成）
> 决策与调研背景: `docs/refactor-analysis.md`（§5 多轮决策定版）

## ✅ 已完成里程碑

| #   | 里程碑                                                                         | commit    | 验证                                |
| --- | ------------------------------------------------------------------------------ | --------- | ----------------------------------- |
| 1   | 骨架 + core 层（PlayerCore / AudioAdapter / providers / lrc / url-parser）     | `cad59bf` | 57 unit                             |
| 2   | Solid UI 等价迁移 + 修 2 bug（lrc 高亮、ended 切歌）                           | `5c362ba` | 60 unit + 5 E2E                     |
| 3   | Review 修复（prev 回退、restore 位置、persist flush、点击外部关闭）+ UI 层测试 | `d0d3387` | 72 unit + 5 E2E                     |
| 4   | 交付层（lib 双产物 / 静态 CSS / `<nyx-player>` / SSR 安全）                    | `ac2868c` | 73 unit + 5 E2E + build+SSR check   |
| 5   | R4 8.1 MediaSession + 媒体键                                                   | `2612812` | 83 unit + 5 E2E + build             |
| 6   | R4 8.2 拖拽 seek + 音量滑杆                                                    | `bdd85ff` | 90 unit + 7 E2E + build             |
| 7   | R4 8.3 歌词增强（行 seek + 卡拉 OK 逐字）                                      | `153fd8c` | 101 unit + 8 E2E + build            |
| 8   | R4 8.4 MiniBar 双形态                                                          | `5b1394d` | 104 unit + 11 E2E + build           |
| 9   | R4 8.5 跨歌单连续播放 + 播放历史                                               | `982abf9` | 115 unit + 11 E2E + build           |
| 10  | R4 8.6 音频可视化 + CPU 性能层级自适应帧率                                     | `37880c4` | 122 unit + 12 E2E + build+SSR check |
| 11  | R4 8.7 中英双语文档站（Astro Starlight）+ README/LICENSE                       | `61c753a` | docs:build 23 页 + demo + pack 核对 |

工具链基线（每次改动必须保持）: `oxlint --type-aware --type-check` / `oxfmt` / `tsc -p tsconfig.json` / `vitest run` / `playwright test` / `pnpm build`（含 ssr-check）全绿，`pnpm lint:ci` / `format:ci` 被 CI 使用。

---

## ✅ 任务 8：R4 扩展功能（8.1–8.6 已完成）

> R4 决策来源: ask 第 4 轮。暂缓项见文末。

### 8.1 MediaSession + 全局媒体键 ✅ `2612812`

- [x] `PlayerCore`/store 层：track 元数据（title/artist/artwork ← Song.pic）
- [x] `navigator.mediaSession.metadata` 更新（effect，随 currentSong 变化）
- [x] Action Handlers: play / pause / previoustrack / nexttrack / seekto（→ PlayerCore 代理）
- [x] 测试: mock session 注入（MediaSessionLike）+ MediaMetadata stub；SSR 守卫（navigator 缺失 no-op）

### 8.2 拖拽 seek + 音量滑杆 ✅ `bdd85ff`

- [x] ProgressBar: role=slider + pointer capture 拖拽（拖中不写回 currentTime，up 时 `store.seek()`）+ 键盘 ±5s
- [x] 音量滑杆（input[type=range]，accent-color 主题化）+ mute 按钮保留；muted 联动显 0
- [x] 测试: pointer 事件单测；E2E route 拦截 mp3 → 本地静音 WAV 拖拽验证

### 8.3 歌词增强 ✅ `153fd8c`

- [x] 窗口化渲染保持当前行居中（active 恒在窗口中部，自带滚动高亮）
- [x] 按行点击 seek: `onClick` 行 → `store.seek(line.start)`
- [x] 卡拉 OK 逐字: LLRC 词级时间戳 `<mm:ss.xx>` → core `parseWordLyric`（兼容纯 LRC 退化整词）+ `activeWordIndex`

### 8.4 MiniBar 双形态 ✅ `5b1394d`

- [x] NyxPlayer props: `mode?: "panel" | "mini"`（默认 panel；展开按钮切回面板）
- [x] MiniBar: 封面 + 标题/歌手 + 播放/暂停 + 展开按钮（复刻 FloatingToolbar）；样式随静态 CSS 打包
- [x] 点击外部关闭判定纳入 MiniBar 根（barRef 共享 panelEl）；preview 支持 `?mode=mini`

### 8.5 跨歌单连续播放 + 播放历史 ✅ `982abf9`

- [x] ended/next 歌单末 → 下一非空歌单（环形回绕，PlaylistSource 顺序；空歌单跳过）；与 mode=loop 单曲循环语义隔离
- [x] 历史栈 `{playlistIndex, songIndex}[]` + cursor 模型：back/forward/clearHistory/getHistory；主动导航丢弃 forward 分支
- [x] PlayerCore 单测（歌单衔接 6 + 历史栈 5）；UI 展示入口暂缓（后续按需）

### 8.6 音频可视化 ✅ `37880c4`

- [x] Visualizer.tsx（canvas 条形频谱，48 bar；挂载即运行/卸载即停；DPR 适配；主题主色）
- [x] AudioAdapter `getContextAnalysis?(): AnalyserNode | null`：懒 AudioContext + MediaElementSource 连回 destination；noop 返回 null
- [x] 低帧率 rAF ~30fps + **CPU 性能层级自适应**：WICG `navigator.cpuPerformance` ≥4 → 60fps，否则/不支持 → 30fps
- [x] E2E canvas 存在且无 pageerror

### 8.7 文档与示例站 ✅ `61c753a`

- [x] README 完整化（API / prop 表 / custom element 用法 / SSR 用法）+ LICENSE（AGPL-3.0 全文）
- [x] 示例: 中英双语文档站（Astro Starlight 11 页，root locale=zh-cn + en）+ 实时 demo（自包含 bundle，可改 `docs/static/demo/sources.js`）+ Cloudflare Pages 部署指南
- [x] 发布前: `pnpm publish --dry-run` / `pnpm pack` 核对（42 文件：dist 双产物 + d.ts + css + assets + README/LICENSE）

> 用户指示（2026-08-23）：文档站用 Astro Starlight，中英双语，Cloudflare Pages，内嵌 demo。已全部落地。

---

## 🕐 明确暂缓（决策时未选，可后续按需启用）

- 键盘快捷键（space/←→/m）—— 与页面快捷键冲突风险，需可配置开关
- 播放速率（0.5x-2x）—— 与卡拉 OK 逐字歌词有联动问题
- bilibili provider —— 依赖 B 站接口稳定性，需标注实验性
- 播放历史 UI 展示入口（core API 已就绪，8.5 验收只到单测）

## 📌 实施注意（从已完成阶段继承的教训）

1. oxlint 类型感知严格：新代码避免 `as` 断言，用类型守卫函数（见 custom-element 解析模式）
2. Solid 1.9: `createResource` 返回元组；Portal 不穿透 Context（Portal 外按钮的点击外部判定需纳入 barRef）；createStore 从 `solid-js/store` 导入
3. 新 UI 组件 JSX 必须在 `.tsx`；`@/` alias 只允许在 `tests/`、`preview/`，`src/` 内一律相对导入
4. 构建链: 新增 dist 产物需同步 `exports` + `files`；SSR 安全以 `scripts/ssr-check.mjs` 验收
5. 每个扩展完成需跑全量: lint/format/tsc/unit/e2e/build，再独立 commit
6. uno presetIcons 是 mask 渲染（`--un-icon` 变量 + mask），判定图标可见看 `getComputedStyle(el).maskImage`/尺寸，backgroundImage 恒 none 是误判
7. E2E 测 seek/duration 必须先点歌曲列表项触发 `syncSourceToAdapter`（直接 play() 时 src 为空）；无网络用 `page.route` 拦截 mp3 → 本地静音 WAV
8. flex 中无固定宽图标按钮会被压缩到 0 宽（Playwright hidden）→ 加 `min-w-*`
9. WICG CPU Performance API（`navigator.cpuPerformance`）明确未批准发布，生产常见 undefined → 渐进增强（无值回退默认帧率）
