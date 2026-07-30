import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

/**
 * The dashboard's test runner.
 *
 * Vitest rather than Jest because the app is already an ESM + TypeScript
 * project and Vitest reads this config directly; Jest would need its own
 * transform chain to agree with what Next already does.
 *
 * jsdom, not a real browser: the goal is to prove that a chart draws the paths
 * its data implies and that a null KPI renders as "—", neither of which needs
 * layout or paint. Screenshot evidence stays a browser job.
 */
/**
 * No `@vitejs/plugin-react`: it only adds Fast Refresh, which a test run has no
 * use for, and it pulls in a second copy of Vite whose plugin types disagree
 * with the one Vitest bundles — `tsc` then fails on this file for reasons that
 * have nothing to do with the tests. Vitest's esbuild transform already reads
 * `jsx: react-jsx` from `tsconfig.json`, so TSX compiles without it.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.tsx'],
    restoreMocks: true,
  },
})
