import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';

export default defineConfig({
	output: 'static',
	server: {
		host: 'localhost',
		port: 3000,
	},
	adapter: cloudflare({
		imageService: 'passthrough',
		prerenderEnvironment: 'node',
	}),
	integrations: [mdx({ remarkPlugins: [remarkGfm] })],
	vite: {
		plugins: [tailwindcss()],
	},
});
