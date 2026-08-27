import { expect, test } from "@playwright/test";
import { silentWav } from "./silent-wav";
import type { Page } from "@playwright/test";

/**
 * Hard MPA（真实多页面硬跳转）E2E 测试套件：
 * 模拟传统多页面架构（Astro / Hexo / Hugo 等静态博客）：
 * 用户在页面 A 播放/调整进度/设置模式音量后，点击普通 <a> 标签发生全页 Hard Navigation，
 * 旧页面 Document、DOM、JS 运行时与 <audio> 实例被彻底销毁，
 * 新页面载入后验证状态原子恢复、进度不归零、无 0:00 闪烁。
 */

async function openPlayer(page: Page): Promise<void> {
  await page.waitForTimeout(800); // 等按钮绑定 effect
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // 拦截 mp3 请求并返回 20s 静音 WAV，提供完整 Range 与 Content-Length 头以支持 Chromium seek
  await page.route("**/*.mp3", (route) => {
    const body = silentWav(20);
    void route.fulfill({
      status: 200,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(body.length),
      },
      body,
    });
  });
});

test("Hard MPA 链接跳转：播放进度与曲目记忆在真实全页跳转后完整恢复", async ({ page }) => {
  // 1. 打开 Page 1
  await page.goto("/");
  await openPlayer(page);

  // 2. demo 首曲内联 3 行歌词（00:00 / 00:10 / 00:20），点击第 2 行歌词 seek 到 0:10
  const rows = page.locator(".nyx-player .lrc ul li");
  await expect(rows).toHaveCount(3);
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 验证第 2 行歌词已高亮
  await expect(rows.nth(1).locator("p")).toHaveClass(/current/);

  // 3. 执行真正的 Hard MPA 页面跳转（点击 <a> 标签，整页卸载重建）
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 4. 验证 Page 2（全新 Document 上新挂载的播放器）
  await openPlayer(page);

  // 验证当前曲目依然是第 1 首
  await expect(page.locator(".nyx-player .nyx-song-list li.current")).toContainText("示例音频 1");
  // 验证进度保留为 0:10，未被重置为 0:00
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");
  // 验证歌词高亮行依然正确停留在 0:10 的那一行
  const page2Rows = page.locator(".nyx-player .lrc ul li");
  await expect(page2Rows.nth(1).locator("p")).toHaveClass(/current/);
  // 验证进度条滑块 aria-valuenow 大于 0
  const track = page.locator(".nyx-progress-track");
  await expect
    .poll(async () => Number(await track.getAttribute("aria-valuenow")))
    .toBeGreaterThanOrEqual(9);
});

test("Hard MPA 链接跳转：切歌到第 2 首并跳转，新页面曲目与进度保持", async ({ page }) => {
  // 1. 打开 Page 1
  await page.goto("/");
  await openPlayer(page);

  // 2. 切到第 2 首歌
  await page.locator(".nyx-player .nyx-song-list li").nth(1).click();
  await expect(page.locator(".nyx-player .nyx-song-list li.current")).toContainText("示例音频 2");

  // 3. 点击超链接执行 Hard Navigation
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 4. 验证 Page 2 保持在第 2 首歌
  await openPlayer(page);
  await expect(page.locator(".nyx-player .nyx-song-list li.current")).toContainText("示例音频 2");
});

test("Hard MPA 链接跳转：播放模式与音量滑杆状态跨页保持", async ({ page }) => {
  // 1. 打开 Page 1
  await page.goto("/");
  await openPlayer(page);

  // 2. 调整播放模式为 loop（循环两次: order → random → loop）
  const modeBtn = page.locator('.nyx-player button[aria-label^="播放模式"]');
  await modeBtn.click(); // → random
  await modeBtn.click(); // → loop
  await expect(page.locator('.nyx-player button[aria-label="播放模式：loop"]')).toBeVisible();

  // 调整音量为 0.35
  const volume = page.locator(".nyx-player .nyx-volume");
  await volume.fill("0.35");
  await expect(volume).toHaveValue("0.35");

  // 3. 点击普通超链接触发 Hard Navigation 跳转
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 4. 在 Page 2 验证模式与音量均保持
  await openPlayer(page);
  await expect(page.locator('.nyx-player button[aria-label="播放模式：loop"]')).toBeVisible();
  const page2Volume = page.locator(".nyx-player .nyx-volume");
  await expect(page2Volume).toHaveValue("0.35");
});

test("Hard MPA 链接跳转：拖拽 seek 后立即离开页面（防抖窗口内），pagehide 同步落盘确保进度不丢失", async ({
  page,
}) => {
  await page.goto("/");
  await openPlayer(page);

  // 触发首曲加载
  await page.locator(".nyx-player .nyx-song-list li").first().click();
  const track = page.locator(".nyx-progress-track");
  await expect(track).toBeVisible();
  await expect
    .poll(async () => Number(await track.getAttribute("aria-valuemax")))
    .toBeGreaterThan(0);

  // 点击第二行歌词 seek 到 0:10
  const rows = page.locator(".nyx-player .lrc ul li");
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 不等待 300ms 防抖，直接点击超链接跳转（依赖 pagehide 同步 flush）
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 验证 Page 2
  await openPlayer(page);
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");
});
