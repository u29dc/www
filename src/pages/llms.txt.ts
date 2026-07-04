import type { APIRoute } from 'astro';
import { formatDate, getPublicArtifacts } from '../lib/artifacts';
import { SITE } from '../data/site';
import { originParagraphs, protocols } from '../data/copy';
import { artifactMarkdownUrl, artifactTextUrl, artifactUrl, toArtifactMarkdown } from '../lib/markdown';
import { absoluteSiteUrl } from '../lib/seo';

const EMBED_ARTIFACTS = true;

const origin = originParagraphs.join('\n\n');

const officialChannels = [
	'(@u29dc everywhere)',
	'Website: https://u29dc.com',
	'Calendar: https://cal.com/u29dc/hey',
	'Instagram: https://instagram.com/u29dc',
	'LinkedIn (Personal): https://linkedin.com/in/u29dc',
	'LinkedIn (Company): https://linkedin.com/company/u29dc',
	'Behance: https://behance.net/u29dc',
	'Dribbble: https://dribbble.com/u29dc',
	'GitHub: https://github.com/u29dc',
	'Twitter: https://twitter.com/u29dc',
	'YouTube: https://youtube.com/@u29dc',
	'Vimeo: https://vimeo.com/u29dc',
	'Medium: https://medium.com/@u29dc',
	'TikTok: https://tiktok.com/@u29dc',
	'500px: https://500px.com/p/u29dc',
	'IMDb: https://www.imdb.com/name/nm10729970',
	'Last updated: May 2026',
	`Full sitemap: ${absoluteSiteUrl('/sitemap.xml')}`,
	`RSS: ${absoluteSiteUrl(SITE.feeds.rss)}`,
	`JSON Feed: ${absoluteSiteUrl(SITE.feeds.json)}`,
].join('\n');

const buildProtocols = (): string =>
	protocols
		.map((protocol) => {
			return `- ${protocol.name}: ${protocol.description}.`;
		})
		.join('\n');

const joinMarkdownBlocks = (blocks: string[]): string =>
	`${blocks
		.map((block) => block.trim())
		.filter(Boolean)
		.join('\n\n')}\n`;

export const GET: APIRoute = async () => {
	const artifacts = await getPublicArtifacts();
	const artifactsText = EMBED_ARTIFACTS
		? artifacts.map(toArtifactMarkdown).join('\n\n---\n\n')
		: artifacts
				.map(
					(entry) =>
						`- [${entry.data.title}](${artifactUrl(entry)}) - ${entry.data.description} (${formatDate(entry.data.date)}). Markdown: ${artifactMarkdownUrl(entry)}. Text: ${artifactTextUrl(entry)}.`,
				)
				.join('\n');

	const body = joinMarkdownBlocks([
		`# ${SITE.name}`,
		SITE.description,
		'## Origin',
		origin,
		'## Protocols',
		buildProtocols(),
		'## Artifacts',
		artifactsText,
		'## Official Channels',
		officialChannels,
	]);

	return new Response(body, {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
