import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@btp/types": path.resolve(__dirname, "../../packages/types/src"),
      "@btp/core": path.resolve(__dirname, "../../packages/core/src"),
    },
  },
});
