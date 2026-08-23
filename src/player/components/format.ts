/** 秒 → m:ss 格式化（原版 ListTab.formatTime 迁移） */
export function formatTime(time: number): string {
  if (!Number.isFinite(time) || time <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
