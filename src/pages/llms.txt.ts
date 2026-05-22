import type { APIRoute } from 'astro';
import { formatDate, getArtifacts } from '../lib/content';
import { SITE } from '../lib/constants';
import { protocols } from '../lib/site-content';
import { artifactMarkdownUrl, artifactTextUrl, artifactUrl, toArtifactMarkdown } from '../lib/markdown';

const EMBED_ARTIFACTS = true;

const shouldEmbedArtifacts = (import.meta.env['PUBLIC_LLMS_EMBED_ARTIFACTS'] ?? String(EMBED_ARTIFACTS)) === 'true';

const origin = [
	'Most of the technology that will matter in the next decade is going to work. It will be funded, built, tested, deployed. The engineering question is being answered. The question that is not being answered - the one that shapes adoption, trust, policy, and public patience - is how it enters the world. What story surrounds it. Whether people who were not in the room can feel why it deserves belief.',
	'My background started in architecture, then moved through computational design at Salon, creative development at Lusion and Nohlab, and creative direction at Lotus during the shift from petrol to electric. What I am choosing to point that range at now is the structural layer where technical credibility either becomes meaning or does not.',
	'Incomplete Infinity is the practice I am building around that work. The name is deliberate. I am interested in structures that stay open enough to be entered, precise enough to be trusted, and strange enough to resist becoming another polished surface. Not completeness as closure, but incompleteness as a live architecture: something others can understand, inhabit, and extend.',
	'The work moves between narrative architecture, creative strategy, and design engineering - depending on what the moment actually demands. Sometimes that means finding the sentence underneath the company. Sometimes it means building the artifact that lets people feel a future before they can explain it. Sometimes it means removing work that should never have been made.',
].join('\n\n');

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
	const artifacts = (await getArtifacts()).filter((entry) => !(entry.data.type === 'study' && entry.data.isConfidential));
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
