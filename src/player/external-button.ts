import { createEffect, onCleanup, untrack } from "solid-js";

/**
 * 外部按钮绑定（页面自定义 showBtn/playBtn 能力，原版 selector/Ref/Element 三态归一化）。
 * - ref 可以是 selector 字符串 / HTMLElement / 返回元素函数
 * - 原子绑定：元素变化自动解绑旧监听（修复原版重复 init 监听器泄漏）
 * - dataset 双向同步交给调用方 effect（play()/show() 信号变化时写 data-*）
 */

export type ExternalButtonRef = string | HTMLElement | (() => HTMLElement | null);

/** 解析 ref 为元素；解析不到返回 null（静默，等元素出现） */
export function resolveExternalButton(ref: ExternalButtonRef | undefined): HTMLElement | null {
  if (!ref) {
    return null;
  }
  if (typeof ref === "function") {
    return ref();
  }
  if (typeof ref === "string") {
    return document.querySelector(ref);
  }
  return ref;
}

/** 绑定点击激活 + 可选 "active" 态同步（写回元素 dataset.active 布尔属性） */
export function useExternalButton(options: {
  ref: ExternalButtonRef | undefined;
  onActivate: () => void;
  /** 响应式 active 状态（比如 playing / showPlayer 信号）；变化时写 el.dataset.active */
  active?: () => boolean;
}): void {
  const { ref, onActivate, active } = options;

  createEffect(() => {
    // 依赖函数 ref 解析结果：ref 变化时重绑
    const el = resolveExternalButton(ref);
    if (!el) {
      return;
    }
    el.addEventListener("click", onActivate);
    onCleanup(() => el.removeEventListener("click", onActivate));
  });

  if (active) {
    createEffect(() => {
      const el = untrack(() => resolveExternalButton(ref));
      if (el) {
        el.dataset.active = active() ? "true" : "false";
      }
    });
  }
}
