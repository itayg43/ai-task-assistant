import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
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
