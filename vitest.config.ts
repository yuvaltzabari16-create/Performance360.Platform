import { defineConfig } from "vitest/config";

// Unit tests live next to the code in src/. The e2e/ folder holds Playwright
// specs, which Vitest must not collect (they call Playwright's test.describe).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
