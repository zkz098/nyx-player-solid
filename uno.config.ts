import type { IconifyJSON } from "@iconify/types";
import { defineConfig, presetIcons, presetWind } from "unocss";

export default defineConfig({
  presets: [
    presetWind(),
    presetIcons({
      collections: {
        ri: () =>
          import("@iconify-json/ri/icons.json").then(
            (m) => (m as { default: IconifyJSON }).default,
          ),
      },
    }),
  ],
});
