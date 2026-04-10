import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hashgraph/sdk', '@hashgraph/hedera-agent-kit'],
    target: 'es2022',
  },
  {
    entry: ['./src/index.ts'],
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: true,
    external: ['@hashgraph/sdk', '@hashgraph/hedera-agent-kit'],
    target: 'node16',
  },
  {
    entry: { cli: './src/cli.ts' },
    outDir: 'dist/bin',
    format: ['cjs'],
    clean: true,
    bundle: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['@hashgraph/sdk', '@hashgraph/hedera-agent-kit'],
    target: 'node18',
  },
]);
