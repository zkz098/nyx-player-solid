import type { JSX } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { MetadataProvider, PlaylistSource } from "@/core";
import { resolveExternalButton } from "./external-button";
import { useExternalButton } from "./external-button";
import type { ExternalButtonRef } from "./external-button";
import { Panel } from "./components/Panel";
import { createPlayerStore, PlayerProvider } from "./store";
import type { PlayerStore, StorageLike } from "./store";
import { useTheme } from "./theme";
import type { DarkModeTarget, ThemePreset } from "./theme";

export interface NyxPlayerProps {
  /** 歌单来源（URL 歌单 / 直链歌曲列表） */
  urls: PlaylistSource[];
  /** 页面自定义"显示/隐藏"按钮（selector / element / 元素函数） */
  showBtn?: ExternalButtonRef;
  /** 页面自定义"播放/暂停"按钮 */
  playBtn?: ExternalButtonRef;
  /** 暗色模式跟随：选择器（存在即暗色）或 "auto" */
  darkModeTarget?: DarkModeTarget;
  /** 颜色预设名：nyx / shokax */
  preset?: string;
  /** 自定义颜色 token 覆盖（深合并，不污染预设） */
  styles?: Partial<ThemePreset>;
  /** 元数据 provider（默认 composite） */
  provider?: MetadataProvider;
  /** 跨页持久化（默认开启；false 关闭；可传自定义 storage） */
  persist?: boolean | StorageLike;
}

/** 根组件：创建实例（工厂隔离）+ 注入 Context + 面板挂到 body + 外部按钮绑定 + 点外部关闭 */
export function NyxPlayer(props: NyxPlayerProps): JSX.Element {
  const store: PlayerStore = createPlayerStore({
    sources: props.urls,
    provider: props.provider,
    storage:
      props.persist === false
        ? null
        : typeof props.persist === "object"
          ? props.persist
          : undefined,
  });
  const [show, setShow] = createSignal(false);
  const [panelEl, setPanelEl] = createSignal<HTMLDivElement | null>(null);

  onMount(() => {
    void store.init();
  });

  useTheme({
    preset: props.preset,
    custom: props.styles,
    darkModeTarget: props.darkModeTarget,
  });

  useExternalButton({
    ref: props.showBtn,
    onActivate: () => setShow((visible) => !visible),
    active: show,
  });
  useExternalButton({
    ref: props.playBtn,
    onActivate: () => store.toggle(),
    active: () => store.state.playing,
  });

  // 点击面板外部关闭（原版 onClickOutside 等价功能；忽略外部按钮点击）
  createEffect(() => {
    if (!show()) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node)) {
        return;
      }
      const target = event.target;
      const panel = panelEl();
      if (panel?.contains(target)) {
        return;
      }
      const showEl = resolveExternalButton(props.showBtn);
      const playEl = resolveExternalButton(props.playBtn);
      if (showEl?.contains(target) || playEl?.contains(target)) {
        return;
      }
      setShow(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    onCleanup(() => document.removeEventListener("pointerdown", onPointerDown));
  });

  return (
    <Portal mount={typeof document !== "undefined" ? document.body : undefined}>
      <Show when={show()}>
        {/* Solid 的 Portal 不继承外层 Context，需在 Portal 内重新注入 */}
        <PlayerProvider store={store}>
          <Panel onClose={() => setShow(false)} panelRef={setPanelEl} />
        </PlayerProvider>
      </Show>
    </Portal>
  );
}
