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
    external: ['@hiero-ledger/sdk', '@hashgraph/hedera-agent-kit', '@elizaos/core'],
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
    external: ['@hiero-ledger/sdk', '@hashgraph/hedera-agent-kit'],
    noExternal: ['@elizaos/core'],
    target: 'node16',
  },
]);
