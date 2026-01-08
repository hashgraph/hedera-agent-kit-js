import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry point (ESM)
  {
    entry: ['./src/index.ts'],
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: [],
    target: 'es2022',
  },
  // Main entry point (CJS)
  {
    entry: ['./src/index.ts'],
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: [],
    target: 'node16',
    noExternal: ['@elizaos/core'],
  },
  // ElizaOS entry point (ESM)
  {
    entry: ['./src/elizaos/index.ts'],
    outDir: 'dist/esm/elizaos',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    bundle: true,
    external: ['@elizaos/core'],
    target: 'es2022',
  },
  // ElizaOS entry point (CJS)
  {
    entry: ['./src/elizaos/index.ts'],
    outDir: 'dist/cjs/elizaos',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    bundle: true,
    external: [],
    target: 'node16',
    noExternal: ['@elizaos/core'],
  }
]);