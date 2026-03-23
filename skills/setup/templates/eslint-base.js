module.exports = {
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: ['eslint:recommended'],
  rules: {
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'import/no-default-export': 'error',
  },
};
