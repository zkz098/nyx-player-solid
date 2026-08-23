import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHTMLAudioAdapter } from "@/core/audio-adapter";

/**
 * HTMLAudioAdapter 分析链的 CORS 安全（回归修复）：
 * MediaElementSourceNode 会接管 audio 输出——跨域无 CORS 头的源接入后
 * WebAudio 输出归零（"outputs zeroes due to CORS"）→ 整个播放静音。
 * 因此只在 同源 / 探测到 CORS 允许 时才接管；其余情况返回 null（播放不受影响）。
 */

class FakeAudioContext {
  state = "running";
  destination = { connect: vi.fn() };
  createAnalyser(): object {
    return {
      fftSize: 0,
      frequencyBinCount: 128,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn(),
    };
  }
  createMediaElementSource(): object {
    return { connect: vi.fn() };
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

beforeAll(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("getContextAnalysis CORS 安全接管", () => {
  it("同源源：空闲时立即接管，返回 analyser", () => {
    const audio = new Audio();
    audio.src = `${location.origin}/music/a.mp3`;
    const adapter = createHTMLAudioAdapter(audio);
    expect(adapter.getContextAnalysis?.()).not.toBeNull();
  });

  it("跨域源无 CORS 头（fetch cors 被拒）→ 不接管，返回 null，播放不受影响", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Audio();
    audio.src = "https://cdn.example.com/audio/a.mp3";
    const adapter = createHTMLAudioAdapter(audio);

    expect(adapter.getContextAnalysis?.()).toBeNull();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://cdn.example.com/audio/a.mp3");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ mode: "cors", method: "HEAD" });
    // 探测失败（无 CORS）后仍不接管
    expect(adapter.getContextAnalysis?.()).toBeNull();
  });

  it("跨域源但有 CORS 头 → 探测通过后接管", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "access-control-allow-origin": "*" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Audio();
    audio.src = "https://cdn.example.com/audio/a.mp3";
    const adapter = createHTMLAudioAdapter(audio);
    expect(adapter.getContextAnalysis?.()).toBeNull();
    await vi.waitFor(() => expect(adapter.getContextAnalysis?.()).not.toBeNull());
  });

  it("（非空闲，暂停但带进度）不中断当前音轨：pending 到下次 setSrc 再挂载", () => {
    const audio = new Audio();
    audio.src = `${location.origin}/music/a.mp3`;
    audio.currentTime = 5; // 模拟有进度的暂停态（防止接管中断）
    const adapter = createHTMLAudioAdapter(audio);
    expect(adapter.getContextAnalysis?.()).toBeNull();

    // 换源时机挂载，不影响正在播放的旧音轨
    adapter.setSrc(`${location.origin}/music/b.mp3`);
    expect(adapter.getContextAnalysis?.()).not.toBeNull();
  });

  it("无 AudioContext 环境（SSR/受限）→ null", () => {
    vi.stubGlobal("AudioContext", undefined);
    const audio = new Audio();
    audio.src = `${location.origin}/a.mp3`;
    const adapter = createHTMLAudioAdapter(audio);
    expect(adapter.getContextAnalysis?.()).toBeNull();
  });
});
