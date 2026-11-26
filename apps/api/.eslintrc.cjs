module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules', 'webpack.config.js'],
  rules: {
    // Same as the NestJS CLI's default config: Passport/OAuth profiles and Prisma JSON are untyped.
    '@typescript-eslint/no-explicit-any': 'off',
    // `const { passwordHash, ...safeUser } = user` is how fields are omitted; `_arg` marks an
    // intentionally unused parameter (e.g. framework callback signatures).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
    ],
  },
};
