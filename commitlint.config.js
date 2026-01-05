export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'docs', 'style', 'chore', 'test', 'build', 'ci', 'perf', 'revert']],
		'type-empty': [2, 'never'],
		'scope-enum': [2, 'always', ['core', 'ui', 'api', 'config', 'deps', 'types', 'utils', 'docs', 'ci', 'release']],
		'scope-empty': [2, 'never'],
		'subject-empty': [2, 'never'],
		'subject-case': [2, 'always', 'lower-case'],
		'subject-full-stop': [2, 'never', '.'],
		'header-max-length': [2, 'always', 100],
		'body-max-line-length': [2, 'always', 100],
	},
};
