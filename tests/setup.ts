import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom 无动画事件（transitionend/animationend）：Transition 组件在单测环境
// 无法完成 exit（元素悬挂），直通渲染 children（动画行为由浏览器/E2E 验证）
vi.mock("solid-transition-group", () => ({
  Transition: (props: { children: unknown }) => props.children,
  TransitionGroup: (props: { children: unknown }) => props.children,
}));

// jsdom 无 PointerEvent 的 matchMedia（主题 auto 模式需要）
if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
