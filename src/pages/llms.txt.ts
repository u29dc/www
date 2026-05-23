import type { APIRoute } from 'astro';
import { formatDate, getPublicArtifacts } from '../lib/content';
import { SITE } from '../lib/constants';
import { originParagraphs, protocols } from '../lib/site-content';
import { artifactMarkdownUrl, artifactTextUrl, artifactUrl, toArtifactMarkdown } from '../lib/markdown';

const EMBED_ARTIFACTS = true;

const shouldEmbedArtifacts = (import.meta.env['PUBLIC_LLMS_EMBED_ARTIFACTS'] ?? String(EMBED_ARTIFACTS)) === 'true';

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
	'Last updated: April 2026',
	`Full sitemap: ${SITE.url}/sitemap.xml`,
].join('\n');

const buildProtocols = (): string =>
	protocols
		.map((protocol) => {
			const range = protocol.name === 'MAP' ? '48 hours' : protocol.name === 'ARC' ? 'scoped after MAP' : 'ongoing';
			return `- ${protocol.name}: ${protocol.meta}; ${range}. ${protocol.description}.`;
		})
		.join('\n');

const joinMarkdownBlocks = (blocks: string[]): string =>
	`${blocks
		.map((block) => block.trim())
		.filter(Boolean)
		.join('\n\n')}\n`;

export const GET: APIRoute = async () => {
	const artifacts = await getPublicArtifacts();
	const artifactsText = shouldEmbedArtifacts
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
