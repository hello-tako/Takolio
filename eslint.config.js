import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'valid-typeof': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
  {
    ignores: ['.artifacts/**', '.hoplite/**', 'dist/**', 'node_modules/**', '.wrangler/**', 'public/**', 'docs/**', '*.config.js', '*.config.ts'],
  },
];
