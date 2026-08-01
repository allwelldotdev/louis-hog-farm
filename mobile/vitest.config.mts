import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest, not jest-expo — deliberately.
 *
 * `make test` and `.claude/hooks/stop_quality_gate.sh` already know how to run
 * `npx vitest run`; a second runner would mean a second transform chain and a
 * quality gate that runs Jest for one project and Vitest for another.
 *
 * The trade is that nothing here renders a React Native component. That is
 * affordable because everything in this app that can be *silently* wrong is
 * pure logic — the error extractor, the single-flight refresh, decimal-string
 * parsing, the sparkline path builder, permission gating, theme resolution. A
 * broken <View> is a blank screen you notice in two seconds; a sparkline that
 * divides by zero is a wrong chart nobody questions.
 *
 * The rule that keeps this honest: any module with a `.test.ts` beside it must
 * be free of `react-native` and `expo-*` imports. Platform access is injected
 * (see `src/api-runtime.ts`), so these modules load in plain node.
 *
 * `.test.ts` only, never `.test.tsx` — the extension is the boundary. A file
 * needing JSX needs a renderer, and that is the machinery this config exists
 * to avoid.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
