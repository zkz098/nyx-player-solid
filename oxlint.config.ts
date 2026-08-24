import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["dist/**", "coverage/**", "playwright-report/**", "docs/**", "node_modules"],
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
      // 重试循环的顺序 await 是合法语义（指数退避），豁免 perf 级提醒；现代接口模板字符串为受控 string
      files: ["src/core/providers/meting.ts", "src/core/providers/modern-meting.ts"],
      rules: {
        "no-await-in-loop": "off",
        "restrict-template-expressions": "off",
        "no-unnecessary-type-conversion": "off",
      },
    },
    {
      // 测试文件常定义一次性局部组件/辅助，豁免作用域外提建议
      files: ["tests/**"],
      rules: {
        "consistent-function-scoping": "off",
      },
    },
  ],
});
