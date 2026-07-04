import type { APIRoute } from 'astro';
import { getPublicArtifacts } from '../lib/artifacts';
import { SITE } from '../data/site';
import { absoluteSiteUrl, escapeXml } from '../lib/seo';

type SitemapEntry = {
	url: string;
	lastModified: Date;
	changeFrequency: 'monthly';
};

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
	const latestArtifactDate = artifacts[0]?.data.date ?? SITE.updatedAt;
	const entries: SitemapEntry[] = [
		{
			url: absoluteSiteUrl('/'),
			lastModified: SITE.updatedAt,
			changeFrequency: 'monthly',
		},
		{
			url: absoluteSiteUrl(SITE.feeds.llms),
			lastModified: SITE.updatedAt,
			changeFrequency: 'monthly',
		},
		{
			url: absoluteSiteUrl(SITE.feeds.rss),
			lastModified: latestArtifactDate,
			changeFrequency: 'monthly',
		},
		{
			url: absoluteSiteUrl(SITE.feeds.json),
			lastModified: latestArtifactDate,
			changeFrequency: 'monthly',
		},
		...artifacts.map((entry) => ({
			url: absoluteSiteUrl(`/${entry.data.slug}/`),
			lastModified: entry.data.date,
			changeFrequency: 'monthly' as const,
		})),
	];

	return new Response(buildSitemap(entries), {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'application/xml; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
