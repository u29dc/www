import { SITE } from '$lib/constants';
import { isStudy } from '$lib/content-types';
import { logEvent } from '$lib/logger';
import { getAllContent } from '$lib/server/content';

type ManifestIcon = {
	src: string;
	sizes: string;
	type: string;
	purpose: 'any' | 'maskable';
};

type ManifestData = {
	name: string;
	short_name: string;
	description: string;
	start_url: string;
	display: 'standalone';
	background_color: string;
	theme_color: string;
	icons: ManifestIcon[];
	orientation: 'portrait';
	categories: string[];
	lang: string;
};

type SitemapEntry = {
	url: string;
	lastModified: Date;
	changeFrequency: 'monthly';
};

const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const buildSitemapXml = (entries: SitemapEntry[]): string => {
	const xmlEntries = entries
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xmlEntries}
</urlset>`;
};

export function generateManifest(): ManifestData {
	const icons: ManifestIcon[] = [
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
		{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	];

	return {
		name: SITE.name,
		short_name: SITE.name,
		description: SITE.description,
		start_url: '/',
		display: 'standalone',
		background_color: SITE.backgroundColor,
		theme_color: SITE.themeColor,
		icons,
		orientation: 'portrait',
		categories: [...SITE.keywords],
		lang: SITE.locale,
	};
}

export function generateRobotsTxt(): string {
	return ['User-agent: *', 'Allow: /', 'Allow: /llms.txt', `Sitemap: ${SITE.url}/sitemap.xml`, ''].join('\n');
}

export async function generateSitemapXml(): Promise<string> {
	try {
		const allContent = await getAllContent();
		const entries: SitemapEntry[] = [
			{
				url: SITE.url,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		];

		for (const item of allContent) {
			if (isStudy(item.frontmatter) && item.frontmatter.isConfidential) continue;

			const { slug, date } = item.frontmatter;
			const lastMod = new Date(date);

			if (slug === 'llms') {
				entries.push({
					url: `${SITE.url}/${slug}.txt`,
					lastModified: lastMod,
					changeFrequency: 'monthly',
				});
				continue;
			}

			entries.push(
				{
					url: `${SITE.url}/${slug}`,
					lastModified: lastMod,
					changeFrequency: 'monthly',
				},
				{
					url: `${SITE.url}/${slug}.md`,
					lastModified: lastMod,
					changeFrequency: 'monthly',
				},
				{
					url: `${SITE.url}/${slug}.txt`,
					lastModified: lastMod,
					changeFrequency: 'monthly',
				},
			);
		}

		return buildSitemapXml(entries);
	} catch (error) {
		logEvent('SITEMAP', 'GENERATE', 'FAIL', {
			error: error instanceof Error ? error.message : String(error),
			fallback: 'homepage-only',
			severity: 'degraded-service',
			impact: 'sitemap-incomplete',
		});

		return buildSitemapXml([
			{
				url: SITE.url,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		]);
	}
}
