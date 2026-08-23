import type { AudioAdapter, AudioAdapterEvent } from "@/core/audio-adapter";

/** 测试替身：实现 AudioAdapter 接口，可手动驱动事件（fake audio 时钟） */
export class FakeAudioAdapter implements AudioAdapter {
  src = "";
  currentTime = 0;
  duration = 100;
  volume = 1;
  muted = false;
  playing = false;

  private readonly handlers = new Map<AudioAdapterEvent, Set<() => void>>();

  setSrc(url: string): void {
    this.src = url;
  }

  getSrc(): string {
    return this.src;
  }

  async play(): Promise<void> {
    this.playing = true;
    this.emit("play");
  }

  pause(): void {
    this.playing = false;
    this.emit("pause");
  }

  seek(time: number): void {
    this.currentTime = time;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  on(event: AudioAdapterEvent, handler: () => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)?.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  dispose(): void {
    this.handlers.clear();
  }

  // ---- 手动事件驱动 ----

  emit(event: AudioAdapterEvent): void {
    this.handlers.get(event)?.forEach((handler) => handler());
  }

  fireEnded(): void {
    this.emit("ended");
  }

  fireError(): void {
    this.emit("error");
  }

  fireTimeupdate(time?: number): void {
    if (time !== undefined) {
      this.currentTime = time;
    }
    this.emit("timeupdate");
  }

  fireLoadedmetadata(): void {
    this.emit("loadedmetadata");
  }
}
