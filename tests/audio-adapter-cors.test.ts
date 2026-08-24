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

  it("跨域源不在 probeOrigins 白名单（网易云外链等直链）→ 不发探测 fetch、无 CORS 噪音，返回 null", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Audio();
    audio.src = "https://music.163.com/song/media/outer/url?id=1";
    const adapter = createHTMLAudioAdapter(audio);

    expect(adapter.getContextAnalysis?.()).toBeNull();
    // 同步判定，不发 fetch（浏览器控制台不再报 CORS blocked）
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("跨域源在白名单但无 CORS 头（fetch cors 被拒）→ 不接管，返回 null，播放不受影响", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Audio();
    audio.src = "https://cdn.example.com/audio/a.mp3";
    const adapter = createHTMLAudioAdapter(audio, { probeOrigins: ["https://cdn.example.com"] });

    expect(adapter.getContextAnalysis?.()).toBeNull();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://cdn.example.com/audio/a.mp3");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ mode: "cors", method: "HEAD" });
    // 探测失败（无 CORS）后仍不接管
    expect(adapter.getContextAnalysis?.()).toBeNull();
  });

  it("跨域源但在白名单且有 CORS 头 → 探测通过后接管", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "access-control-allow-origin": "*" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Audio();
    audio.src = "https://cdn.example.com/audio/a.mp3";
    const adapter = createHTMLAudioAdapter(audio, { probeOrigins: ["https://cdn.example.com"] });
    expect(adapter.getContextAnalysis?.()).toBeNull();
    await vi.waitFor(() => expect(adapter.getContextAnalysis?.()).not.toBeNull());
  });

  it("（非空闲，暂停但带进度）亦立即接管（同源/CORS 允许时无缝切换，波形首播可见）", () => {
    const audio = new Audio();
    audio.src = `${location.origin}/music/a.mp3`;
    audio.currentTime = 5; // 模拟有进度的暂停态
    const adapter = createHTMLAudioAdapter(audio);
    // 8.6 修复后改为立即接管（MediaElementSource 接管已连回 destination，播放中亦可无缝切换）
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
