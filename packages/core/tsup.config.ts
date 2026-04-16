import { defineConfig } from 'tsup';
import * as path from 'node:path';

const allEntries: Record<string, string> = {
  index: './src/index.ts',
  plugins: './src/plugins/index.ts',
  hooks: './src/hooks/index.ts',
  policies: './src/policies/index.ts',
};

const srcAlias = { '@': path.resolve(__dirname, 'src') };

export default defineConfig([
  {
    entry: allEntries,
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hiero-ledger/sdk'],
    target: 'es2022',
    esbuildOptions(options) {
      options.alias = srcAlias;
    },
  },
  {
    entry: allEntries,
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hiero-ledger/sdk'],
    target: 'node16',
    esbuildOptions(options) {
      options.alias = srcAlias;
    },
  },
]);
