# NyxPlayer Solid — TODO

> 状态时间: 2026-08-23
> 决策与调研背景: `docs/refactor-analysis.md`（§5 多轮决策定版）

## ✅ 已完成里程碑

| # | 里程碑 | commit | 验证 |
|---|--------|--------|------|
| 1 | 骨架 + core 层（PlayerCore / AudioAdapter / providers / lrc / url-parser） | `cad59bf` | 57 unit |
| 2 | Solid UI 等价迁移 + 修 2 bug（lrc 高亮、ended 切歌） | `5c362ba` | 60 unit + 5 E2E |
| 3 | Review 修复（prev 回退、restore 位置、persist flush、点击外部关闭）+ UI 层测试 | `d0d3387` | 72 unit + 5 E2E |
| 4 | 交付层（lib 双产物 / 静态 CSS / `<nyx-player>` / SSR 安全） | `ac2868c` | 73 unit + 5 E2E + build+SSR check |

工具链基线（每次改动必须保持）: `oxlint --type-aware --type-check` / `oxfmt` / `tsc -p tsconfig.json` / `vitest run` / `playwright test` / `pnpm build`（含 ssr-check）全绿，`pnpm lint:ci` / `format:ci` 被 CI 使用。

---

## 🚧 任务 8：R4 扩展功能（决策已定，按此顺序实施）

> R4 决策来源: ask 第 4 轮。暂缓项见文末。

### 8.1 MediaSession + 全局媒体键（小，先做）
- [ ] `PlayerCore`/store 层：track 元数据（title/artist/artwork ← Song.pic）
- [ ] `navigator.mediaSession.metadata` 更新（effect，随 currentSong 变化）
- [ ] Action Handlers: play / pause / previoustrack / nexttrack / seekto（→ PlayerCore 代理）
- [ ] 测试: node/jsdom mock mediaSession（或 FakeAudioAdapter 方式注入）；SSR 守卫（`navigator` 可能不存在）
- 验收: 单测覆盖 handler 转发；E2E 可选（浏览器无媒体会话 UI）

### 8.2 拖拽 seek + 音量滑杆
- [ ] PlayerCore: 已具备 `seek`/`setVolume`（Core 无需改）
- [ ] UI: ListTab/面板内进度条动画 + **pointer 拖拽**（pointerdown/move/up，拖拽中不写回 currentTime，up 时 `store.seek()`）
- [ ] 音量滑杆（input[type=range] 或自定义）替代纯 mute 开关；保留 mute 按钮
- [ ] 测试: solid-testing-library 模拟 pointer 事件；core 已有 seek/volume 单测
- 验收: E2E 拖进度条 → `state.currentTime` 变化；音量拖杆 → `state.volume`

### 8.3 歌词增强（滚动高亮修复 + 按行 seek + 卡拉 OK 逐字，可选拆分）
- [ ] 滚动高亮: 当前行居中/滚动容器（现有 findActiveLyricIndex 已就绪）
- [ ] 按行点击 seek: `onClick` 行 → `store.seek(line.start)`
- [ ] 卡拉 OK 逐字: LLRC 结构（词级时间戳 `<mm:ss.xx>` 词）—— 需新的 core 解析器 `parseWordLyric`（保留向后兼容）
- 验收: 单测 parseWordLyric；组件点击行 seek

### 8.4 MiniBar 双形态
- [ ] NyxPlayer props: `mode?: "panel" | "mini"`（或 `minibar: boolean`）
- [ ] MiniBar 组件: 封面 + 标题 + 播放/暂停 + 展开按钮（复刻原版 FloatingToolbar 形态）
- [ ] 样式随静态 CSS 打包（uno 类在 dist css）
- 验收: E2E 两种形态渲染；拖动/固定位置样式

### 8.5 跨歌单连续播放 + 播放历史
- [ ] PlayerCore: `ended` 时歌单播完跳到下一歌单（PlaylistSource 顺序）—— 注意与 mode=loop 语义交互
- [ ] 播放历史: 已有 `history: number[]`（歌曲索引）基础 → 升级为 `{playlistIndex, songIndex}[]` + 前进/后退/清空 API
- [ ] 测试: PlayerCore 单测（歌单衔接、历史栈）
- 验收: 单测覆盖；行为与 UI 状态（可后续加展示入口）

### 8.6 音频可视化（AnalyserNode + canvas）
- [ ] 独立组件 `Visualizer.tsx`（不污染现有布局，折叠时关闭）
- [ ] `AudioAdapter` 需要暴露 audio 元素或 analyser 入口（接口新增 `getContextAnalysis?(): AnalyserNode | null` — HTMLAudioAdapter 实现；noop 返回 null）
- [ ] 低帧率（rAF ~30fps）+ 仅在展开态渲染；canvas 适配 DPR
- 验收: E2E 可见 canvas 元素（真实音频分析在 headless 受限，功能验收到"不报错+canvas 存在"）

### 8.7 文档与示例站
- [ ] README 完整化（API / prop 表 / custom element 用法 / SSR 用法）
- [ ] 示例: direct provider / meting 自托管端点 / 自定义主题 / Astro 集成示例
- [ ] 发布前: `pnpm publish --dry-run` 核对 files 内容

---

## 🕐 明确暂缓（决策时未选，可后续按需启用）
- 键盘快捷键（space/←→/m）—— 与页面快捷键冲突风险，需可配置开关
- 播放速率（0.5x-2x）—— 与卡拉 OK 逐字歌词有联动问题
- bilibili provider —— 依赖 B 站接口稳定性，需标注实验性

## 📌 实施注意（从已完成阶段继承的教训）
1. oxlint 类型感知严格：新代码避免 `as` 断言，用类型守卫函数（见 custom-element 解析模式）
2. Solid 1.9: `createResource` 返回元组；Portal 不穿透 Context；createStore 从 `solid-js/store` 导入
3. 新 UI 组件 JSX 必须在 `.tsx`；`@/` alias 只允许在 `tests/`、`preview/`，`src/` 内一律相对导入
4. 构建链: 新增 dist 产物需同步 `exports` + `files`；SSR 安全以 `scripts/ssr-check.mjs` 验收
5. 每个扩展完成需跑全量: lint/format/tsc/unit/e2e/build，再独立 commit