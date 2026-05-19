import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import * as path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "web/src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.js"],
    include: ["shared/**/*.test.js", "cli/**/*.test.js", "web/src/**/*.test.js", "web/src/**/*.test.jsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
