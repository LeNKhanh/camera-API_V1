module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: null,
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
      },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  // Fix false "cannot find module" for local TS files (e.g. ptz.service/ptz.controller)
  // by explicitly configuring the import resolvers for TypeScript + Node.
  settings: {
    'import/resolver': {
      typescript: {
        // Point to the main tsconfig for path + extension resolution
        project: './tsconfig.json'
      },
      node: {
        extensions: ['.ts', '.js', '.json']
      }
    }
  },
  ignorePatterns: ['dist', 'node_modules']
};
