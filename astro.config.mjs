import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';

export default defineConfig({
	site: 'https://u29dc.com',
	output: 'static',
	compressHTML: true,
	prerenderConflictBehavior: 'error',
	build: {
		inlineStylesheets: 'never',
	},
	server: {
		host: 'localhost',
		port: 3000,
	},
	adapter: cloudflare({
		configPath: './wrangler.jsonc',
		imageService: 'passthrough',
		prerenderEnvironment: 'node',
	}),
	integrations: [mdx({ remarkPlugins: [remarkGfm] })],
	vite: {
		plugins: [tailwindcss()],
	},
});
