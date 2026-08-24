import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import type { PlaylistSource } from "@/core";
import { createPlayerStore, PlayerProvider } from "@/player/store";
import { AudioInfo } from "@/player/components/AudioInfo";
import { FakeAudioAdapter } from "./fakes/fake-audio-adapter";

/**
 * AudioInfo 错误提示渲染：播放失败（版权/源无效）时展示 state.error 行。
 * 走真实链路：FakeAudioAdapter.play 注入失败 → store.play() → core 分类文案 → UI 渲染。
 */

const sources: PlaylistSource[] = [
  {
    name: "demo",
    songs: [{ name: "版权曲", artist: "艺人", url: "https://a.mp3", pic: "", lrc: "" }],
  },
];

async function setup() {
  const adapter = new FakeAudioAdapter();
  const store = createPlayerStore({ sources, adapter });
  await store.init();
  const view = render(() => (
    <PlayerProvider store={store}>
      <AudioInfo />
    </PlayerProvider>
  ));
  return { store, adapter, view };
}

describe("AudioInfo 播放错误提示", () => {
  it("无版权音源 → 渲染提示行", async () => {
    const { store, adapter, view } = await setup();
    adapter.playFailure = new DOMException("no supported source", "NotSupportedError");
    store.play();
    await Promise.resolve();
    await Promise.resolve();
    const line = view.queryByTestId("playback-error");
    expect(line).not.toBeNull();
    expect(line).toHaveTextContent("该曲暂无版权或无可用音源");
  });

  it("autoplay 拒绝静默 → 无提示行", async () => {
    const { store, adapter, view } = await setup();
    adapter.playFailure = new DOMException("gesture", "NotAllowedError");
    store.play();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.queryByTestId("playback-error")).toBeNull();
  });

  it("播放成功 → 提示行消失", async () => {
    const { store, adapter, view } = await setup();
    adapter.playFailure = new DOMException("no supported source", "NotSupportedError");
    store.play();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.queryByTestId("playback-error")).not.toBeNull();

    adapter.playFailure = null;
    store.play();
    await Promise.resolve();
    expect(view.queryByTestId("playback-error")).toBeNull();
  });
});
