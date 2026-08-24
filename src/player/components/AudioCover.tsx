import type { JSX } from "solid-js";
import { createMemo, createResource, Show } from "solid-js";
import { usePlayer } from "../store";
import { useCurrentSong } from "./useCurrentSong";

function forceHttps(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

function upgradeCdnPic(url: string): string {
  if (!url) return url;
  url = forceHttps(url);
  if (url.includes("music.126.net")) {
    return url.replace(/\?param=\d+y\d+/, "?param=500y500");
  }
  if (url.includes("y.gtimg.cn")) {
    return url.replace(/T002R\d+x\d+M000/, "T002R500x500M000");
  }
  return url;
}

/** 唱片封面 + 唱针（原版 AudioCover.vue；旋转由 playing 驱动，切歌时封面重建触发淡入） */
export function AudioCover(): JSX.Element {
  const { state } = usePlayer();
  const song = useCurrentSong();
  const rawPic = () => song()?.pic ?? "";
  // meting 的 pic 可能是二次跳转链接（api.injahow.cn/meting/?type=pic），最终 302 到 90y90；
  // 此处对直链 CDN 已在 toSong 升级，对跳转链接则跟随重定向后再二次升级至 500y500
  const [resolvedPic] = createResource(rawPic, async (url) => {
    if (!url) return "";
    const direct = upgradeCdnPic(url);
    if (direct !== url) return direct;
    if (url.includes("type=pic")) {
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "manual" });
        const loc = res.headers.get("Location");
        if (loc) return upgradeCdnPic(loc);
      } catch {}
      // 兜底：跟随重定向后的最终 URL（部分浏览器 / CF 可能不暴露 Location 头）
      try {
        const res2 = await fetch(url, { method: "GET", redirect: "follow" });
        if (res2.url) return upgradeCdnPic(res2.url);
      } catch {}
    }
    return url;
  });
  const pic = createMemo(() => resolvedPic() ?? rawPic());

  return (
    <div
      class="cover relative flex flex-shrink-0 cursor-pointer items-center justify-center"
      classList={{ playing: state.playing }}
    >
      <div class="disc relative max-h-48 max-w-48 p-6">
        <Show
          keyed
          when={pic()}
          fallback={<div class="cover-placeholder h-6rem w-6rem rounded-50%" />}
        >
          {(src) => (
            <div class="cover-blur-in h-6rem w-6rem overflow-hidden rounded-50%">
              <img src={src} alt="音乐封面" class="max-h-full max-w-full" />
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
