import { generateSitemapXml } from '$lib/server/metadata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const xml = await generateSitemapXml();
	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
};
