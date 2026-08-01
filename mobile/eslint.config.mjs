import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Mirrors web-dashboard/eslint.config.mjs, minus `eslint-config-next`. There is
// no Expo-provided flat config that plays well with typescript-eslint's own
// `tseslint.config()` helper, so react-hooks is registered by hand here — which
// is safe precisely because nothing else registers it (the web config cannot do
// this, since `eslint-config-next` already brings the plugin along).
export default tseslint.config(
  {
    ignores: [
      '.expo/**',
      'expo-env.d.ts',
      // Generated from the backend's OpenAPI document by `make types`. Linting
      // machine output only produces findings nobody can act on.
      'src/lib/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `configs['recommended-latest']` is still the eslintrc shape in v7 (its
  // `plugins` is an array of strings); the flat-config equivalents live one
  // level down under `configs.flat`. Using the wrong one fails the entire lint
  // run with a migration-guide dump that never names this file.
  reactHooks.configs.flat['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
