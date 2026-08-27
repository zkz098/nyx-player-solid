import { expect, test } from "@playwright/test";
import { silentWav } from "./silent-wav";
import type { Page } from "@playwright/test";

/**
 * P0 E2E：播放态跨页断点即时续播（Playback Resume & Autoplay Gesture Integration）
 * 模拟用户在 Page 1 播放过程中跳转至 Page 2：
 * 验证在 Page 2 用户首次交互（点击外部 #play 或面板控制器播放）时，
 * 音频能从离开前的进度无缝开播，时间向前推进，封面旋转，不归零且不报 NotAllowedError。
 */

async function openPlayer(page: Page): Promise<void> {
  await page.waitForTimeout(800);
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
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

test("播放中硬跳转：离开前 seek 到 0:10 并点击播放，跳页后点击播放从 0:10 续播推进", async ({
  page,
}) => {
  // 1. 打开 Page 1 并 seek 到 0:10
  await page.goto("/");
  await openPlayer(page);
  const rows = page.locator(".nyx-player .lrc ul li");
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 2. 点击播放（触发 audio.play()）
  await page.locator('.nyx-player button[aria-label="播放"]').click();
  await expect(page.locator(".nyx-player .cover")).toHaveClass(/playing/);

  // 3. 在播放状态下直接点击 <a> 标签发生全页 Hard Navigation
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 4. Page 2 加载后（由于 Autoplay 策略，新页面初始处于就绪暂停态，保留离开前的时间）
  await openPlayer(page);
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 5. 用户在 Page 2 点击播放按钮（提供 User Gesture）
  await page.locator('.nyx-player button[aria-label="播放"]').click();
  await expect(page.locator(".nyx-player .cover")).toHaveClass(/playing/);

  // 6. 验证播放开始后时间继续向前推进（不回退到 0:00）
  await expect
    .poll(async () => {
      const track = page.locator(".nyx-progress-track");
      return Number(await track.getAttribute("aria-valuenow"));
    })
    .toBeGreaterThanOrEqual(10);
});

test("未展开面板时直接使用外部 #play 按钮唤醒续播", async ({ page }) => {
  // 1. 打开 Page 1 并 seek 到 0:10
  await page.goto("/");
  await openPlayer(page);
  const rows = page.locator(".nyx-player .lrc ul li");
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 2. 跳转到 Page 2
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 3. 在 Page 2 不点击 #show 打开面板，而是直接点击页面外部 #play 按钮
  await page.waitForTimeout(600); // 等按钮绑定 effect
  await page.locator("#play").click();

  // 4. 打开面板验证：封面正在旋转（播放中），且时间已经从 0:10 开始推进
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
  await expect(page.locator(".nyx-player .cover")).toHaveClass(/playing/);
  await expect
    .poll(async () => {
      const track = page.locator(".nyx-progress-track");
      return Number(await track.getAttribute("aria-valuenow"));
    })
    .toBeGreaterThanOrEqual(10);
});
