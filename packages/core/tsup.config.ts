import { defineConfig } from 'tsup';

const allEntries: Record<string, string> = {
  index: './src/index.ts',
  plugins: './src/plugins/index.ts',
};

export default defineConfig([
  {
    entry: allEntries,
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hashgraph/sdk'],
    target: 'es2022',
  },
  {
    entry: allEntries,
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hashgraph/sdk'],
    target: 'node16',
  },
]);
