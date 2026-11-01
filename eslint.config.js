import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'docs/design-prototype'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Game rules stay renderer-free so they can be tested and simulated headless.
    files: ['src/systems/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'phaser',
              message: 'src/systems must not import Phaser (see AGENTS.md rule 2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.js', '*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
