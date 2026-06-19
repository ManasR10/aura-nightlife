module.exports = {
  root: true,
  env: { es2017: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { project: ['tsconfig.json'], sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['lib/**', '.eslintrc.js'],
};
