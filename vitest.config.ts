import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/cli/commands/update-pricing.ts"],
      thresholds: {
        "src/parsers/**/*.ts": { lines: 80, functions: 80, branches: 70, statements: 80 },
        "src/attribution/**/*.ts": { lines: 80, functions: 80, branches: 70, statements: 80 },
        "src/detectors/**/*.ts": { lines: 80, functions: 80, branches: 70, statements: 80 },
        "src/render/**/*.ts": { lines: 60, functions: 60, branches: 50, statements: 60 },
        "src/cli/**/*.ts": { lines: 60, functions: 60, branches: 45, statements: 60 },
      },
    },
  },
});
