import { generateRobotsTxt } from '$lib/server/metadata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const body = generateRobotsTxt();
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'CDN-Cache-Control': 'no-store',
			'Cloudflare-CDN-Cache-Control': 'no-store',
		},
	});
};
