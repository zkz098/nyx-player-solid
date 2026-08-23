import { expect, test } from "@playwright/test";
import { silentWav } from "./silent-wav";
import type { Page } from "@playwright/test";

/**
 * R4 8.2 E2E：进度条拖拽 seek + 音量滑杆。
 * 无网络依赖：page.route 拦截 SoundHelix mp3 → 本地生成的 10s 静音 WAV，
 * 使 audio 真正加载出 duration，拖拽/seek 可被验证。
 */

async function openPlayer(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForTimeout(800); // 等按钮绑定 effect
  await page.locator("#show").click();
  await expect(page.locator(".nyx-player.panel")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*.mp3", (route) => {
    void route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav(10) });
  });
});

test("进度条拖拽 seek：拖动位置实时显示，松手后 currentTime 生效", async ({ page }) => {
  await openPlayer(page);

  // 点击歌曲触发源加载（playSong → syncSource → route 拦截 WAV → duration 可用）
  await page.locator(".nyx-player .nyx-song-list li").first().click();
  const track = page.locator(".nyx-progress-track");
  await expect(track).toBeVisible();
  await expect
    .poll(async () => Number(await track.getAttribute("aria-valuemax")))
    .toBeGreaterThan(0);

  const box = await track.boundingBox();
  if (!box) {
    throw new Error("progress track has no bounding box");
  }

  // 按下 + 拖到 75%：拖拽中 aria-valuenow 实时跟随拖动位置
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect
    .poll(async () => Number(await track.getAttribute("aria-valuenow")))
    .toBeGreaterThan(1);

  // 松手：seek 生效（位置 ≈ 75% × 10s），时间文本不再 0:00
  await page.mouse.up();
  await expect
    .poll(async () => Number(await track.getAttribute("aria-valuenow")))
    .toBeGreaterThan(5);
  await expect(page.locator(".nyx-player .nyx-time")).not.toContainText("0:00 / 0:10");
});

test("音量滑杆：拖动设定音量，静音切换后恢复原值", async ({ page }) => {
  await openPlayer(page);

  const volume = page.locator(".nyx-player .nyx-volume");
  await volume.fill("0.5");
  await expect(volume).toHaveValue("0.5");

  // 静音：滑杆显示 0，按钮变"取消静音"
  await page.locator('.nyx-player button[aria-label^="静音"]').click();
  await expect(page.locator('.nyx-player button[aria-label="取消静音"]')).toHaveCount(1);
  await expect(volume).toHaveValue("0");

  // 取消静音：恢复原值
  await page.locator('.nyx-player button[aria-label="取消静音"]').click();
  await expect(volume).toHaveValue("0.5");
});

test("歌词行点击 seek：点击第二行跳转到 0:10", async ({ page }) => {
  await openPlayer(page);

  // demo 内联 3 行歌词（00:00 / 00:10 / 00:20）
  const rows = page.locator(".nyx-player .lrc ul li");
  await expect(rows).toHaveCount(3);
  await rows.nth(1).click();
  await expect(page.locator(".nyx-player .nyx-time")).toContainText("0:10 /");
});
