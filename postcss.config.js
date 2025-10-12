const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const config = {
	plugins: {
		'@tailwindcss/postcss': {},
		autoprefixer: {},
		...(IS_PRODUCTION
			? {
					cssnano: {
						preset: [
							'default',
							{
								discardComments: { removeAll: true },
								colormin: true,
								mergeRules: true,
								minifyFontValues: true,
								normalizeWhitespace: true,
								zindex: false,
							},
						],
					},
				}
			: {}),
	},
};

export default config;
