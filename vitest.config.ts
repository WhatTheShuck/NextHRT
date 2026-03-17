import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    execArgv: ["--localstorage-file=/tmp/vitest-localstorage.db"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
