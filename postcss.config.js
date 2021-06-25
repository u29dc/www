module.exports = {
	plugins: {
		'tailwindcss': {},
		'postcss-import': {},
		'postcss-import-url': {},
		'autoprefixer': {},
		'postcss-sorting': { 'properties-order': 'alphabetical' },
		'cssnano': {
			preset: ['default', { discardComments: { removeAll: true } }],
		},
	},
};
