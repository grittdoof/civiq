import { defineConfig } from "vitest/config";
import path from "node:path";

// ═══════════════════════════════════════════════════════════════
// Vitest — tests unitaires de la logique métier pure
// (state-machine, cost-calc). E2E reste sur Playwright.
//
// Run : npm test
// ═══════════════════════════════════════════════════════════════

export default defineConfig({
  // JSX des modules serveur (.tsx react-pdf) : runtime automatique, comme Next.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.{test,spec}.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
