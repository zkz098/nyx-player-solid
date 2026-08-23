// 最小冒烟脚本：加载 preview，点 show 按钮，验证面板渲染与无页面错误
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5199";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

await page.goto(BASE);
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(1000);

const showBtn = page.locator("#show");
await showBtn.click();
await page.waitForSelector(".nyx-player.panel", { state: "visible", timeout: 5000 });

const checks = {
  panelVisible: await page.isVisible(".nyx-player.panel"),
  playButton: await page.locator('.nyx-player button[aria-label="播放"]').count(),
  modeButton: await page.locator('.nyx-player button[aria-label^="播放模式"]').count(),
  playlistTab: await page.locator(".nyx-player .tabs li").count(),
  songRow: await page.locator(".nyx-player .nyx-song-list li").count(),
};

console.log(JSON.stringify({ ...checks, errors }, null, 2));
await browser.close();

if (checks.panelVisible && checks.playButton > 0 && checks.songRow > 0 && errors.length === 0) {
  console.log("SMOKE OK");
} else {
  console.error("SMOKE FAILED");
  process.exitCode = 1;
}
