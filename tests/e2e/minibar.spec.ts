import { expect, test } from "@playwright/test";
import { silentWav } from "./silent-wav";
import type { Page } from "@playwright/test";

/** R4 8.4 E2E：mini 形态渲染（?mode=mini）+ 展开切换回完整面板 */

test.beforeEach(async ({ page }) => {
  // 外部音频 → 本地静音 WAV（消除 SoundHelix 网络依赖）
  await page.route("**/*.mp3", (route) => {
    void route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav(10) });
  });
});

async function openMini(page: Page): Promise<void> {
  await page.goto("/?mode=mini");
  await page.waitForTimeout(800);
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.nyx-minibar")).toBeVisible();
}

test("mini 形态：浮条渲染（封面/标题/播放/展开），无完整面板", async ({ page }) => {
  await openMini(page);

  await expect(page.locator(".nyx-player.nyx-minibar")).toHaveCount(1);
  await expect(page.locator(".nyx-player.panel")).toHaveCount(0);
  await expect(page.locator(".nyx-player.nyx-minibar")).toContainText("示例音频 1");
  await expect(page.locator('.nyx-player button[aria-label="播放"]')).toHaveCount(1);
  await expect(page.locator('.nyx-player button[aria-label="展开播放器"]')).toHaveCount(1);
});

test("mini 形态：播放/暂停切换", async ({ page }) => {
  await openMini(page);

  await page.locator('.nyx-player button[aria-label="播放"]').click();
  await expect(page.locator('.nyx-player button[aria-label="暂停"]')).toHaveCount(1);
  await page.locator('.nyx-player button[aria-label="暂停"]').click();
  await expect(page.locator('.nyx-player button[aria-label="播放"]')).toHaveCount(1);
});

test("mini 形态：展开按钮切换到完整面板", async ({ page }) => {
  await openMini(page);

  await page.locator('.nyx-player button[aria-label="展开播放器"]').click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
  // 等待面板完全渲染/按钮可交互（展开动画后立即点击偶发不触发）
  await page.waitForTimeout(600);
  // 完整面板控制器可用（下一首）
  await page.locator('.nyx-player button[aria-label="下一首"]').click();
  await expect(page.locator(".nyx-song-list li.current")).toContainText("示例音频 2");
});
