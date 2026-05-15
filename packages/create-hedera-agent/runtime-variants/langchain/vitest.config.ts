import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      // Overlay-owned paths win over the template fallback. Order matters —
      // vitest matches alias prefixes longest-first, so the deeper paths come
      // before `@/`.
      {
        find: /^@\/features\/chat-runtime\/(.*)$/,
        replacement: path.resolve(__dirname, "./src/features/chat-runtime/$1"),
      },
      {
        find: /^@\/features\/chat-hedera\/server\/toolkit$/,
        replacement: path.resolve(
          __dirname,
          "./src/features/chat-hedera/server/toolkit",
        ),
      },
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, "../../template/src/$1"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
