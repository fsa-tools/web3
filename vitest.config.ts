import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});

// Type-level tests are checked via: npm run type-check or npx tsc --noEmit
