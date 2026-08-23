import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E：只打 preview（直链 demo 不走第三方网络），核心断言走 UI 状态。
 * 回归用例（lrc 高亮 / ended 切歌）由 core 单测 + FakeAudioAdapter 覆盖，E2E 不依赖真实媒体播放。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5199",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
