import cloudflare from '@astrojs/cloudflare';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';
import { glslStringMinify } from './scripts/glsl';
import { remarkMediaPriority } from './scripts/media';

export default defineConfig({
	site: 'https://u29dc.com',
	output: 'static',
	compressHTML: true,
	prerenderConflictBehavior: 'error',
	devToolbar: {
		enabled: false,
	},
	build: {
		inlineStylesheets: 'never',
	},
	markdown: {
		processor: unified({
			remarkPlugins: [remarkGfm, remarkMediaPriority],
		}),
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
	integrations: [mdx()],
	vite: {
		build: {
			minify: 'esbuild',
		},
		plugins: [glslStringMinify(), tailwindcss()],
	},
});
