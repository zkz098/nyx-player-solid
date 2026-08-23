# NyxPlayer Solid — TODO

> 状态时间: 2026-08-23
> 决策与调研背景: `docs/refactor-analysis.md`（§5 多轮决策定版）

## ✅ 已完成里程碑（R1-R4 全部完成）

| # | 里程碑 | commit | 验证 |
|---|--------|--------|------|
| 1 | 骨架 + core 层（PlayerCore / AudioAdapter / providers / lrc / url-parser） | `cad59bf` | 57 unit |
| 2 | Solid UI 等价迁移 + 修 2 bug（lrc 高亮、ended 切歌） | `5c362ba` | 60 unit + 5 E2E |
| 3 | Review 修复（prev 回退、restore 位置、persist flush、点击外部关闭）+ UI 层测试 | `d0d3387` | 72 unit + 5 E2E |
| 4 | 交付层（lib 双产物 / 静态 CSS / `<nyx-player>` / SSR 安全） | `ac2868c` | 73 unit + 5 E2E + build+SSR check |
| 5 | R4 8.1 MediaSession + 媒体键 | `2612812` | 83 unit + 5 E2E + build |
| 6 | R4 8.2 拖拽 seek + 音量滑杆 | `bdd85ff` | 90 unit + 7 E2E + build |
| 7 | R4 8.3 歌词增强（行 seek + 卡拉 OK 逐字） | `153fd8c` | 101 unit + 8 E2E + build |
| 8 | R4 8.4 MiniBar 双形态 | `5b1394d` | 104 unit + 11 E2E + build |
| 9 | R4 8.5 跨歌单连续播放 + 播放历史 | `982abf9` | 115 unit + 11 E2E + build |
| 10 | R4 8.6 音频可视化 + CPU 性能层级自适应帧率 | `37880c4` | 122 unit + 12 E2E + build+SSR check |
| 11 | R4 8.7 中英双语文档站（Astro Starlight）+ README/LICENSE | `61c753a` | docs:build 23 页 + demo + pack 核对 |
| 12 | UI 修复轮：controller/图标/跨域静音/dev uno 注入/尺寸/时间错位/tab/直接播放/动画 | `05a87c1`… | 129 unit + 12 E2E + build+SSR |

工具链基线（每次改动必须保持）: `oxlint --type-aware --type-check` / `oxfmt` / `tsc -p tsconfig.json` / `vitest run` / `playwright test` / `pnpm build`（含 ssr-check）全绿，`pnpm lint:ci` / `format:ci` 被 CI 使用。

---

## 🚧 待处理（未知/已知问题）

- **dev 样式注入稳定性（已知，已 workaround）**: uno vite 插件 66.8.1 在 vite8/rolldown 下 dev 注入偶发整体丢失 / 首载生成不全 / route.abort 的 meting fetch 挂起曾引发页面 reload 状态重置竞态。
  当前形态: `scripts/dev.mjs` = **uno CLI --watch 预生成 src/generated-uno.css（先同步生成再并行 watch+vite）+ preview import 静态 css**（vite 插件已移除）。
  遗留: 修复机制本身仍依赖 watch 时序；后续可验证 unocss 新版本对 vite8 的官方支持后回归"插件直接注入"。
- **meting fetch 在 E2E route.abort 下挂起**（pool 永不 settle）：E2E 已不再依赖网易云歌单（preview 移除，仅 docs demo 保留），未深究浏览器层面根因。
- ~~dev 页面网易云歌单~~（已从 preview 移除；文档站 demo 保留，见 docs/static/demo/sources.js）

## 🕐 明确暂缓（决策时未选，可后续按需启用）
- 键盘快捷键（space/←→/m）—— 与页面快捷键冲突风险，需可配置开关
- 播放速率（0.5x-2x）—— 与卡拉 OK 逐字歌词有联动问题
- bilibili provider —— 依赖 B 站接口稳定性，需标注实验性
- 播放历史 UI 展示入口（core API 已就绪，8.5 验收只到单测）

## 📌 实施注意（继承教训）
1. oxlint 类型感知严格：新代码避免 `as` 断言，用类型守卫函数
2. Solid 1.9: `createResource` 返回元组；createStore 从 `solid-js/store` 导入；**Transition/TransitionGroup 在 `solid-transition-group` 包（非 solid-js/web）**
3. 新 UI 组件 JSX 必须在 `.tsx`；`src/` 内相对导入
4. 构建链: 新增 dist 产物需同步 `exports` + `files`；SSR 安全以 `scripts/ssr-check.mjs` 验收
5. 每个扩展完成需跑全量: lint/format/tsc/unit/e2e/build，再独立 commit
6. uno presetIcons 是 mask 渲染（`--un-icon` 变量）；**图标可见判定用 getBoundingClientRect**（computed width 恒 1em 误导）；图标类需 `display:inline-block`（extraProperties）
7. CSS 选择器坑：`.nyx-player .slideRight-*`（后代）不匹配面板自身多类 → 用同元素 `.nyx-player.slideRight-*`；动画用 transition 方案（solid-transition-group 走 transitionend/加上 animationend）
8. E2E 无网络：用 page.route 拦截 mp3 → 本地静音 WAV（tests/e2e/silent-wav.ts）；**route.abort 的 fetch 可能挂起**——E2E 避免触发真实网络歌单
9. 播放器 dev 演示（preview）保持直链 demo；网易云等网络歌单放文档站 demo（docs/static/demo/sources.js）
10. Windows: 目录大小写改名需临时名过渡；写 .gitignore 注意行尾换行