import type { APIRoute } from 'astro';
import { SITE } from '../data/site';

const manifest = {
	name: SITE.name,
	short_name: SITE.name,
	description: SITE.description,
	start_url: '/',
	display: 'standalone',
	background_color: SITE.backgroundColor,
	theme_color: SITE.themeColorLight,
	icons: [
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	],
	orientation: 'portrait',
	categories: SITE.keywords,
	lang: SITE.lang,
} as const;

export const GET: APIRoute = () =>
	new Response(JSON.stringify(manifest), {
		headers: {
			'Content-Type': 'application/manifest+json; charset=utf-8',
		},
	});
