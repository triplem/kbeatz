import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import i18next from 'eslint-plugin-i18next'

export default tseslint.config(
  { ignores: ['dist', 'src/api/generated', 'node_modules', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      i18next,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // i18next: enforce translation usage in production source only (not tests)
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            exclude: [
              'testIdPrefix',
              'testId',
              'data-testid',
              'className',
              'fieldName',
              'type',
              'scope',
              'role',
              'color',
              'size',
              'variant',
              'path',
              'href',
              'src',
              'id',
              'htmlFor',
              'name',
              'value',
              'albumTitle',
              'to',
              'key',
              'scopeDescribedBy',
              'aria-describedby',
              'aria-labelledby',
              'aria-controls',
              // MUI styling and structural props carry layout values, not
              // user-facing copy, so they are exempt from i18n extraction.
              'sx',
              'component',
              'media',
              'srcSet',
              'alt',
              'position',
              'edge',
              'maxWidth',
              'spacing',
              'direction',
              'alignItems',
            ],
          },
        },
      ],
    },
  },
)
