// ESLint v9 flat config bridging using @eslint/eslintrc FlatCompat so we can keep legacy .eslintrc.js style.
const { FlatCompat } = require('@eslint/eslintrc');
const compat = new FlatCompat({ baseDirectory: __dirname });

const legacy = require('./.eslintrc.js');
// Extract legacy pieces we need
const { rules, settings } = legacy;

module.exports = [
	// Base extends converted
	...compat.extends(
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'prettier'
	),
	{
		files: ['**/*.ts'],
		ignores: ['dist/**', 'node_modules/**'],
		languageOptions: {
			parser: require('@typescript-eslint/parser'),
			parserOptions: { sourceType: 'module', ecmaVersion: 'latest' }
		},
		plugins: {
			'@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
			import: require('eslint-plugin-import'),
		},
		rules,
		settings,
	}
];
