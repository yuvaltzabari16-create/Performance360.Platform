import { defineConfig } from "vitest/config";

// Unit tests live next to the code in src/; e2e/ is run by Playwright.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
