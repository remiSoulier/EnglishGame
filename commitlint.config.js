export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'test', 'refactor', 'docs', 'style', 'chore', 'build', 'ci', 'perf'],
    ],
    'scope-enum': [2, 'always', ['engine', 'ui', 'state', 'pwa', 'data', 'setup', 'e2e', 'docs']],
  },
};
