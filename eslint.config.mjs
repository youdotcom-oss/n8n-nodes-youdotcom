import { config } from '@n8n/node-cli/eslint';

export default [
  ...config,
  // Test files use bun:test (the bun test runner) and are not shipped — only
  // dist/ is published (see package.json "files"). The n8n Cloud compatibility
  // rule disallows bun:test for shipped source, so scope the allowance to tests.
  // Requires `n8n.strict: false` (the strict config-integrity check otherwise
  // forbids any eslint.config.mjs change); shipped source keeps the full rule set.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@n8n/community-nodes/no-restricted-imports': 'off',
      'import-x/no-unresolved': 'off',
    },
  },
];
