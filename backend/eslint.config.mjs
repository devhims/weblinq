import antfu from '@antfu/eslint-config';

export default antfu(
  {
    type: 'app',
    typescript: true,
    formatters: true,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: 'single',
      commaDangle: 'always-multiline',
    },
    ignores: ['**/migrations/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'antfu/no-top-level-await': ['off'],
      'node/prefer-global/process': ['off'],
      'node/no-process-env': ['error'],
      'perfectionist/sort-imports': [
        'error',
        {
          internalPattern: ['@/*'],
        },
      ],
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: ['README.md', 'API_KEY_TESTING.md'],
        },
      ],
      'style/arrow-parens': 'off',
      'style/operator-linebreak': 'off',
      'style/brace-style': 'off',
      'style/indent': 'off',
      'style/comma-dangle': 'off',
    },
  },
);
