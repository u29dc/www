import type { APIRoute } from 'astro';
import { getPublicArtifacts, type ArtifactEntry } from '../lib/artifacts';
import { SITE } from '../data/site';
import { artifactUrl } from '../lib/markdown';
import { absoluteSiteUrl, escapeXml } from '../lib/seo';

const getLastBuildDate = (artifacts: ArtifactEntry[]): Date => artifacts[0]?.data.date ?? SITE.updatedAt;

const getArtifactType = (entry: ArtifactEntry): string => (entry.data.type === 'study' ? 'Study' : 'Writing');

const getArtifactCategories = (entry: ArtifactEntry): string[] => [getArtifactType(entry), ...entry.data.tags];

const buildItem = (entry: ArtifactEntry): string => {
	const url = artifactUrl(entry);
	const categories = getArtifactCategories(entry)
		.map((category) => `\t\t<category>${escapeXml(category)}</category>`)
		.join('\n');

	return [
		'\t<item>',
		`\t\t<title>${escapeXml(entry.data.title)}</title>`,
		`\t\t<link>${escapeXml(url)}</link>`,
		`\t\t<guid isPermaLink="true">${escapeXml(url)}</guid>`,
		`\t\t<description>${escapeXml(entry.data.description)}</description>`,
		`\t\t<pubDate>${entry.data.date.toUTCString()}</pubDate>`,
		categories,
		'\t</item>',
	].join('\n');
};

const buildFeed = (artifacts: ArtifactEntry[]): string => {
	const items = artifacts.map(buildItem).join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
	<title>${escapeXml(SITE.name)}</title>
	<link>${escapeXml(SITE.url)}</link>
	<description>${escapeXml(SITE.description)}</description>
	<language>${escapeXml(SITE.lang)}</language>
	<lastBuildDate>${getLastBuildDate(artifacts).toUTCString()}</lastBuildDate>
	<generator>Astro</generator>
	<ttl>1440</ttl>
	<atom:link href="${escapeXml(absoluteSiteUrl(SITE.feeds.rss))}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;
};

export const GET: APIRoute = async () => {
	const artifacts = await getPublicArtifacts();

	return new Response(buildFeed(artifacts), {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
