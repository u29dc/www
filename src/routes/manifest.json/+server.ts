import { generateManifest } from '$lib/server/metadata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const body = JSON.stringify(generateManifest());
	return new Response(body, {
		headers: {
			'Content-Type': 'application/manifest+json; charset=utf-8',
		},
	});
};
