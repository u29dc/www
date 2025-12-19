import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import adapter from 'svelte-adapter-bun';

const mdsvexConfig = {
	extensions: ['.mdx'],
};

const config = {
	extensions: ['.svelte', '.mdx'],
	preprocess: [vitePreprocess(), mdsvex(mdsvexConfig)],
	kit: {
		adapter: adapter(),
		alias: {
			'@': './src',
		},
	},
};

export default config;
