import { defineConfig } from 'vitest/config'
import * as path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'test/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'examples/**',
      'src/**/types.ts',
      'src/**/index.ts',
      'src/**/*.d.ts'
    ],
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: path.resolve(__dirname, 'coverage'),
      reporter: ['text', 'html'],
      enabled: false,
    },
    setupFiles: [],
  },
})
