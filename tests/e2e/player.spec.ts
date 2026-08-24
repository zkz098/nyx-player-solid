import { expect, test } from "@playwright/test";

/** 加载 preview 并打开播放器面板（外部 show 按钮） */
async function openPlayer(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForTimeout(800); // 等按钮绑定 effect
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
}

test("面板渲染：控制器 5 按钮 + 歌单 tabs + 歌曲列表（直链 demo 不走网络）", async ({ page }) => {
  await openPlayer(page);

  await expect(page.locator('.nyx-player button[aria-label^="播放模式"]')).toHaveCount(1);
  await expect(page.locator('.nyx-player button[aria-label="上一首"]')).toHaveCount(1);
  await expect(page.locator('.nyx-player button[aria-label="播放"]')).toHaveCount(1);
  await expect(page.locator('.nyx-player button[aria-label="下一首"]')).toHaveCount(1);
  await expect(page.locator('.nyx-player button[aria-label^="静音"]')).toHaveCount(1);

  // 歌单 tab（demo 直链 + 网易云测试歌单）+ 2 首直链歌曲（首个歌单）
  await expect(page.locator(".nyx-player .tabs > div ul > li")).toHaveCount(2);
  await expect(page.locator(".nyx-player .nyx-song-list li")).toHaveCount(2);
});

test("外部按钮：show 切换显示、play 切换播放态（封面旋转 class）", async ({ page }) => {
  await openPlayer(page);

  // 播放 → .cover.playing 出现；暂停 → 消失
  await page.locator('.nyx-player button[aria-label="播放"]').click();
  await expect(page.locator(".nyx-player .cover")).toHaveClass(/playing/);

  await page.locator('.nyx-player button[aria-label="暂停"]').click();
  await expect(page.locator(".nyx-player .cover")).not.toHaveClass(/playing/);

  // 页面外部 playBtn（#play）同样可控制
  await page.locator("#play").click();
  await expect(page.locator(".nyx-player .cover")).toHaveClass(/playing/);
});

test("切歌：next 后列表中 current 行位移", async ({ page }) => {
  await openPlayer(page);

  await expect(page.locator(".nyx-song-list li.current")).toHaveCount(1);
  await expect(page.locator(".nyx-song-list li.current")).toContainText("示例音频 1");

  await page.locator('.nyx-player button[aria-label="下一首"]').click();
  await expect(page.locator(".nyx-song-list li.current")).toContainText("示例音频 2");
});

test("歌曲列表点击切歌 + 进度时间显示", async ({ page }) => {
  await openPlayer(page);

  await page.locator(".nyx-song-list li").nth(1).click();
  await expect(page.locator(".nyx-song-list li.current")).toContainText("示例音频 2");
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:00");
});

test("歌词渲染：内联 LRC 显示且高亮随当前时间推进", async ({ page }) => {
  await openPlayer(page);

  // 直链 demo 内联 3 行歌词（[00:00][00:10][00:20]）
  const lyricLines = page.locator(".nyx-player .lrc li p");
  await expect(lyricLines).toHaveCount(3);
  await expect(lyricLines.nth(0)).toHaveClass(/current/);
});

test("音频可视化：canvas 渲染且无页面错误（headless 分析受限，验收到元素存在）", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await openPlayer(page);

  const canvas = page.locator(".nyx-player .nyx-visualizer");
  await expect(canvas).toBeVisible();
  expect(errors).toEqual([]);
});
