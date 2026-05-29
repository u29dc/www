import type { APIRoute } from 'astro';
import { getPublicArtifacts } from '../lib/artifacts';
import { SITE } from '../data/site';

type SitemapEntry = {
	url: string;
	lastModified: Date;
	changeFrequency: 'monthly';
};

const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

const buildSitemap = (entries: SitemapEntry[]): string => {
	const body = entries
		.map(
			(entry) => `
<url>
	<loc>${escapeXml(entry.url)}</loc>
	<lastmod>${entry.lastModified.toISOString()}</lastmod>
	<changefreq>${entry.changeFrequency}</changefreq>
</url>`,
		)
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}
</urlset>`;
};

export const GET: APIRoute = async () => {
	const artifacts = await getPublicArtifacts();
	const latestArtifactDate = artifacts[0]?.data.date ?? new Date();
	const entries: SitemapEntry[] = [
		{
			url: new URL('/', SITE.url).toString(),
			lastModified: new Date(),
			changeFrequency: 'monthly',
		},
		{
			url: new URL('/llms.txt', SITE.url).toString(),
			lastModified: new Date(),
			changeFrequency: 'monthly',
		},
		{
			url: new URL('/rss.xml', SITE.url).toString(),
			lastModified: latestArtifactDate,
			changeFrequency: 'monthly',
		},
		{
			url: new URL('/feed.json', SITE.url).toString(),
			lastModified: latestArtifactDate,
			changeFrequency: 'monthly',
		},
		...artifacts.map((entry) => ({
			url: new URL(`/${entry.data.slug}/`, SITE.url).toString(),
			lastModified: entry.data.date,
			changeFrequency: 'monthly' as const,
		})),
	];

	return new Response(buildSitemap(entries), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
};
