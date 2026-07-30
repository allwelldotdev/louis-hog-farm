import js from '@eslint/js'
import next from 'eslint-config-next'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      // Generated from the backend's OpenAPI document by `make types`. Linting
      // machine output only produces findings nobody can act on.
      'src/lib/api/schema.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `eslint-config-next` already registers eslint-plugin-react-hooks,
  // eslint-plugin-jsx-a11y and the import resolver. Re-registering react-hooks
  // by hand — as the old Vite config did — throws "Cannot redefine plugin" and
  // the whole lint run fails with an error that says nothing about the cause.
  ...next,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
