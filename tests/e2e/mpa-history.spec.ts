import { expect, test } from "@playwright/test";
import { silentWav } from "./silent-wav";
import type { Page } from "@playwright/test";

/**
 * P0 E2E：浏览器前进 / 后退（History Navigation & BFCache）
 * 模拟用户在 MPA 站点中点击浏览器"后退"（page.goBack()）和"前进"（page.goForward()）：
 * 验证在浏览器历史导航回退/前进时，播放器的曲目、时间进度与模式音量状态正确对齐且无异常。
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

test("浏览器后退（goBack）：在 Page 2 调整状态后后退，Page 1 正确保持最新持久化现场", async ({
  page,
}) => {
  // 1. 打开 Page 1 并切到第 2 首
  await page.goto("/");
  await openPlayer(page);
  await page.locator(".nyx-player .nyx-song-list li").nth(1).click();
  await expect(page.locator(".nyx-player .nyx-song-list li.current")).toContainText("示例音频 2");

  // 2. 跳转到 Page 2
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 3. 在 Page 2 调整音量为 0.42 并切换到模式 loop
  await openPlayer(page);
  const volume = page.locator(".nyx-player .nyx-volume");
  await volume.fill("0.42");
  const modeBtn = page.locator('.nyx-player button[aria-label^="播放模式"]');
  await modeBtn.click(); // random
  await modeBtn.click(); // loop
  await expect(page.locator('.nyx-player button[aria-label="播放模式：loop"]')).toBeVisible();

  // 4. 点击浏览器后退按钮返回 Page 1
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.has("page"));

  // 5. 验证 Page 1：曲目依然是第 2 首，音量 0.42，模式 loop
  await openPlayer(page);
  await expect(page.locator(".nyx-player .nyx-song-list li.current")).toContainText("示例音频 2");
  const page1Volume = page.locator(".nyx-player .nyx-volume");
  await expect(page1Volume).toHaveValue("0.42");
  await expect(page.locator('.nyx-player button[aria-label="播放模式：loop"]')).toBeVisible();
});

test("浏览器前进（goForward）：Page 1 后退后再前进至 Page 2，进度与状态完整重现", async ({
  page,
}) => {
  // 1. 打开 Page 1 并 seek 到 0:10
  await page.goto("/");
  await openPlayer(page);
  const rows = page.locator(".nyx-player .lrc ul li");
  await expect(rows).toHaveCount(3);
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");

  // 2. 跳转到 Page 2
  await page.locator("#nav-link").click();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 3. 浏览器后退到 Page 1
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.has("page"));

  // 4. 浏览器前进到 Page 2
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("page") === "2");

  // 5. 验证 Page 2：进度依然为 0:10，曲目与歌词高亮对应
  await openPlayer(page);
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10");
  const page2Rows = page.locator(".nyx-player .lrc ul li");
  await expect(page2Rows.nth(1).locator("p")).toHaveClass(/current/);
});
