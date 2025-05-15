import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    ui: true,
    api: {
      port: 51204,
    },
    coverage: {
      enabled: true,
      reporter: ["text", "json", "html"],
      exclude: [
        "src/app.ts",
        "src/env.ts",
        "src/server.ts",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
