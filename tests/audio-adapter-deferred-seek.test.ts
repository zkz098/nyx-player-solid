import { describe, expect, it } from "vitest";
import { createHTMLAudioAdapter } from "@/core/audio-adapter";

describe("HTMLAudioAdapter 延迟 Seek (Deferred Seek) 与 readyState 处理", () => {
  it("readyState < 1 时 seek 记录 pendingSeek，getCurrentTime 返回待恢复时间", () => {
    const audio = new Audio();
    // 模拟新创建但尚未加载元数据的 audio 元素（readyState = 0）
    Object.defineProperty(audio, "readyState", { value: 0, writable: true, configurable: true });
    let internalCurrentTime = 0;
    Object.defineProperty(audio, "currentTime", {
      get: () => internalCurrentTime,
      set: (val: number) => {
        internalCurrentTime = val;
      },
      configurable: true,
    });

    const adapter = createHTMLAudioAdapter(audio);
    adapter.setSrc("https://example.com/test.mp3");

    // readyState 为 0 时 seek
    adapter.seek(45);

    // audio 尚未就绪，getCurrentTime 返回 pendingSeekTime (45)
    expect(adapter.getCurrentTime()).toBe(45);
    // 原生 audio.currentTime 尚未被直接写入（避免部分浏览器抛错或被重置）
    expect(internalCurrentTime).toBe(0);

    // 触发 loadedmetadata
    Object.defineProperty(audio, "readyState", { value: 1, writable: true, configurable: true });
    audio.dispatchEvent(new Event("loadedmetadata"));

    // 元数据就绪后，pendingSeek 被应用到 audio.currentTime
    expect(internalCurrentTime).toBe(45);
    expect(adapter.getCurrentTime()).toBe(45);
  });

  it("readyState >= 1 时 seek 直接赋值 audio.currentTime", () => {
    const audio = new Audio();
    Object.defineProperty(audio, "readyState", { value: 2, writable: true, configurable: true });
    let internalCurrentTime = 0;
    Object.defineProperty(audio, "currentTime", {
      get: () => internalCurrentTime,
      set: (val: number) => {
        internalCurrentTime = val;
      },
      configurable: true,
    });

    const adapter = createHTMLAudioAdapter(audio);
    adapter.seek(30);

    expect(internalCurrentTime).toBe(30);
    expect(adapter.getCurrentTime()).toBe(30);
  });

  it("换源 setSrc 时重置 pendingSeekTime，避免旧源进度污染新源", () => {
    const audio = new Audio();
    Object.defineProperty(audio, "readyState", { value: 0, writable: true, configurable: true });
    const adapter = createHTMLAudioAdapter(audio);

    adapter.seek(45);
    expect(adapter.getCurrentTime()).toBe(45);

    // 切换到新源
    adapter.setSrc("https://example.com/new.mp3");
    expect(adapter.getCurrentTime()).toBe(0);
  });
});
