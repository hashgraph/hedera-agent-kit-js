# ADR 001: Dual Build with tsup for ESM and CJS

- **Status:** Accepted
- **Date:** 2025-08-20

## Context

We are using a package (`@elizaos/core`) that is ESM-only.  
Our project needs to support both **ESM** and **CommonJS** consumers.  
Without proper bundling, the CJS build would fail when requiring this dependency.

## Decision

We decided to use **tsup** to generate two builds:

1. **ESM build**
   - Output: `typescript/dist/esm`
   - Bundles everything except external dependencies.
   - Does **not** bundle `@elizaos/core`.

2. **CJS build**
   - Output: `typescript/dist/cjs`
   - Explicitly bundles `@elizaos/core` (via `noExternal`), ensuring compatibility.

The configuration is defined in [`/typescript/tsup.config.ts`](../../typescript/tsup.config.ts):

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["./src/index.ts"],
    outDir: "dist/esm",
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: [],
    target: "es2022",
  },
  {
    entry: ["./src/index.ts"],
    outDir: "dist/cjs",
    format: ["cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: [],
    target: "node16",
    noExternal: ["@elizaos/core"],
  },
]);
```
