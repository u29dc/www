import cloudflare from '@astrojs/cloudflare';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';
import { glslStringMinify } from './scripts/glsl';
import { remarkMediaPriority } from './scripts/media';

const site = 'https://u29dc.com';
const siteUrl = new URL(site);

export default defineConfig({
	site,
	output: 'static',
	compressHTML: true,
	prerenderConflictBehavior: 'error',
	security: {
		checkOrigin: true,
		allowedDomains: [
			{
				protocol: 'https',
				hostname: siteUrl.hostname,
			},
		],
		actionBodySizeLimit: 1024 * 1024,
		serverIslandBodySizeLimit: 1024 * 1024,
	},
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
		prerenderEnvironment: 'workerd',
	}),
	integrations: [mdx()],
	vite: {
		build: {
			target: 'baseline-widely-available',
			minify: 'oxc',
			cssMinify: 'lightningcss',
			sourcemap: false,
		},
		plugins: [glslStringMinify(), tailwindcss()],
	},
});
