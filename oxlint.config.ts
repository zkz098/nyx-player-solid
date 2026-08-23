import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },
  rules: {
    "no-underscore-dangle": [
      "error",
      {
        allow: ["_type", "_pending", "_x", "_y"],
      },
    ],
  },
  overrides: [
    {
      // 重试循环的顺序 await 是合法语义（指数退避），豁免 perf 级提醒
      files: ["src/core/providers/meting.ts"],
      rules: {
        "no-await-in-loop": "off",
      },
    },
  ],
});
