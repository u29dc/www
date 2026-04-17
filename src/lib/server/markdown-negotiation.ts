import { SITE } from '$lib/constants';
import type { ParsedContent } from '$lib/content-types';
import { CONTENT_SIGNAL_POLICY, estimateMarkdownTokens } from '$lib/server/agent-policy';
import { getPublicArtifactBySlug, getPublicArtifacts } from '$lib/server/artifacts';
import { toMarkdown } from '$lib/server/content';

type AcceptType = {
	type: string;
	q: number;
};

export const HTML_MODE_COOKIE_NAME = 'u29dc-html';

const AGENT_UA_PATTERNS = [
	/\bChatGPT-User\b/i,
	/\bGPTBot\b/i,
	/\bClaudeBot\b/i,
	/\bClaude-Web\b/i,
	/\bAnthropic\b/i,
	/\bPerplexityBot\b/i,
	/\bCohereBot\b/i,
	/\bCopilot\b/i,
	/\bai2-bot\b/i,
	/\bCCBot\b/i,
	/\bGoogle-Extended\b/i,
	/\bApplebot-Extended\b/i,
	/\bBytespider\b/i,
	/\bYouBot\b/i,
	/\bcurl\b/i,
	/\bwget\b/i,
	/\bhttpie\b/i,
] as const;

const BROWSER_UA_PATTERN = /(Mozilla\/5\.0).*(Chrome|CriOS|Safari|Firefox|FxiOS|Edg|Edge|OPR|SamsungBrowser)/i;

type ProtocolSummary = {
	title: string;
	subtitle: string;
	price: string;
	timeline: string;
	description: string;
};

type ContactLink = {
	title: string;
	value: string;
	href: string;
	note?: string;
};

const SLUG_PATH_PATTERN = /^\/([a-z0-9-]+)$/;

const SIGNAL_SECTION_PARAGRAPHS = [
	'Most companies building complex technology can explain what they do. Fewer can make anyone feel why it matters.',
	"The explanation is fluent. The team is credible, the market is real. But somewhere between what's been built and what the world believes, the signal breaks down.",
	'The usual response is cosmetic: compress everything into a tagline, redesign the website, shoot a launch film. It helps for a month. Then the same problem returns because the problem was never the surface. It was the structure underneath.',
	"When the investor narrative says one thing, the customer story says another, and the careers page says a third, that's a coherence problem. No amount of polish fixes architecture.",
	"What's missing is narrative architecture: the structural logic underneath how a company explains itself, so the team can make decisions and build artifacts from the same foundation.",
] as const;

const PROTOCOLS: readonly ProtocolSummary[] = [
	{
		title: 'MAP',
		subtitle: 'Diagnose',
		price: 'GBP 3,000',
		timeline: '48 hours',
		description: 'Strategic diagnosis within 48 hours. We audit the current narrative, identify where coherence breaks down, and deliver three actionable routes forward.',
	},
	{
		title: 'ARC',
		subtitle: 'Architect',
		price: 'GBP 15,000-40,000',
		timeline: '4-6 weeks',
		description: 'Full narrative architecture: strategy, creative direction, and a flagship artifact the team can scale from. Scope is set after MAP.',
	},
	{
		title: 'ADV',
		subtitle: 'Steward',
		price: 'GBP 4,000-8,000 per month',
		timeline: '3-month minimum',
		description: 'Fractional creative direction with ongoing strategic counsel, artifact development, and narrative coherence as the company scales.',
	},
] as const;

const ORIGIN_SECTION_PARAGRAPHS = [
	'Eight years across architecture, new media art, creative technology, and brand strategy, including three years inside Lotus Cars during its EV transformation.',
	'The work sits in the gaps between disciplines, where technical, strategic, and narrative systems stop lining up cleanly.',
] as const;

const CONTACT_LINKS: readonly ContactLink[] = [
	{
		title: 'Calendar',
		value: "Let's meet",
		href: 'https://cal.com/u29dc/hey',
		note: 'Always open to conversations that question premises, not only solve within them.',
	},
	{
		title: 'Email',
		value: 'han@u29dc.com',
		href: 'mailto:han@u29dc.com',
		note: 'Typical response time: 48 hours.',
	},
	{
		title: 'Instagram',
		value: '@u29dc',
		href: 'https://instagram.com/u29dc',
	},
	{
		title: 'LinkedIn',
		value: 'u29dc',
		href: 'https://linkedin.com/in/u29dc',
	},
] as const;

const parseAcceptTypes = (acceptHeader: string | null): AcceptType[] => {
	if (!acceptHeader) return [];

	return acceptHeader.split(',').map((entry) => {
		const [type, ...params] = entry.trim().split(';');
		const qParam = params.find((param) => param.trim().startsWith('q='));
		const qValue = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;

		return {
			type: type?.trim().toLowerCase() ?? '',
			q: Number.isFinite(qValue) ? qValue : 1,
		};
	});
};

const userAgentLooksLikeAgent = (userAgent: string): boolean => AGENT_UA_PATTERNS.some((pattern) => pattern.test(userAgent));

export const isLikelyBrowserNavigationRequest = ({ request, userAgent }: { request: Request; userAgent: string }): boolean => {
	if (userAgentLooksLikeAgent(userAgent)) {
		return false;
	}

	const hasBrowserLikeUserAgent = BROWSER_UA_PATTERN.test(userAgent);
	const secFetchMode = request.headers.get('sec-fetch-mode')?.toLowerCase();
	const secFetchDest = request.headers.get('sec-fetch-dest')?.toLowerCase();
	const hasAcceptLanguage = request.headers.has('accept-language');
	const isDocumentNavigation = secFetchMode === 'navigate' || secFetchDest === 'document';
	const hasBrowserClientHints = request.headers.has('sec-ch-ua') || request.headers.has('sec-ch-ua-platform');
	const hasUpgradeInsecureRequests = request.headers.get('upgrade-insecure-requests') === '1';

	return hasBrowserLikeUserAgent && (isDocumentNavigation || hasAcceptLanguage || hasBrowserClientHints || hasUpgradeInsecureRequests);
};

const requestAcceptsMarkdown = (request: Request): boolean => {
	const method = request.method.toUpperCase();
	if (method !== 'GET' && method !== 'HEAD') {
		return false;
	}

	const acceptTypes = parseAcceptTypes(request.headers.get('accept'));
	if (!acceptTypes.some((entry) => entry.q > 0 && entry.type === 'text/markdown')) {
		return false;
	}

	const userAgent = request.headers.get('user-agent') ?? '';
	return !isLikelyBrowserNavigationRequest({
		request,
		userAgent,
	});
};

const createMarkdownResponse = ({ request, markdown }: { request: Request; markdown: string }): Response => {
	const byteLength = new TextEncoder().encode(markdown).length;

	return new Response(request.method.toUpperCase() === 'HEAD' ? null : markdown, {
		status: 200,
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'content-length': String(byteLength),
			'cache-control': 'private, no-store, must-revalidate',
			'cdn-cache-control': 'no-store',
			'cloudflare-cdn-cache-control': 'no-store',
			'content-signal': CONTENT_SIGNAL_POLICY,
			vary: 'Accept',
			'x-markdown-tokens': String(estimateMarkdownTokens(markdown)),
		},
	});
};

const appendArtifactFooter = (markdown: string): string => `${markdown}\n\n---\n\nFull sitemap: ${SITE.url}/sitemap.xml\n`;

const formatDate = (value: string): string =>
	new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).format(new Date(value));

const buildArtifactMarkdown = (entry: ParsedContent): string => appendArtifactFooter(toMarkdown(entry.frontmatter, entry.content));

const formatArtifactList = (artifacts: ParsedContent[]): string => {
	if (artifacts.length === 0) {
		return '- No public artifacts available right now.';
	}

	return artifacts
		.map((artifact) => {
			const { title, description, slug, type, date } = artifact.frontmatter;
			return `- [${title}](${SITE.url}/${slug}) (${type}, ${formatDate(date)}): ${description}. Markdown: ${SITE.url}/${slug}.md`;
		})
		.join('\n');
};

const buildHomeMarkdown = async (): Promise<string> => {
	const artifacts = await getPublicArtifacts();
	const signalSection = SIGNAL_SECTION_PARAGRAPHS.map((paragraph) => paragraph).join('\n\n');
	const protocolsSection = PROTOCOLS.map(
		(protocol) => `### ${protocol.title} - ${protocol.subtitle}\n\n- Price: ${protocol.price}\n- Timeline: ${protocol.timeline}\n- ${protocol.description}`,
	).join('\n\n');
	const originSection = ORIGIN_SECTION_PARAGRAPHS.join('\n\n');
	const contactSection = CONTACT_LINKS.map((link) => {
		const note = link.note ? ` (${link.note})` : '';
		return `- ${link.title}: [${link.value}](${link.href})${note}`;
	}).join('\n');

	return [
		'---',
		`title: ${SITE.title}`,
		`description: ${SITE.description}`,
		`url: ${SITE.url}/`,
		`content-signal: ${CONTENT_SIGNAL_POLICY}`,
		'---',
		'',
		`# ${SITE.title}`,
		'',
		"The technology works. The story doesn't.",
		'',
		SITE.description,
		'',
		'## Signal',
		'',
		signalSection,
		'',
		'## Protocols',
		'',
		protocolsSection,
		'',
		'## Public Artifacts',
		'',
		formatArtifactList(artifacts),
		'',
		'## Origin',
		'',
		'### Han',
		'',
		originSection,
		'',
		'## Contact',
		'',
		contactSection,
		'',
		'## Newsletter',
		'',
		`POST ${SITE.url}/api/newsletter`,
		'',
		'- Form fields: `email`, `source`, `website` (honeypot)',
		'- Successful requests return JSON with `ok: true` and `code: SUBSCRIBED`.',
		'- When the D1 binding is unavailable, the endpoint returns `503` with `code: UNAVAILABLE`.',
		'',
		'## Agent Access',
		'',
		`- LLMS context: ${SITE.url}/llms.md`,
		`- Sitemap: ${SITE.url}/sitemap.xml`,
		`- Raw markdown artifacts: ${SITE.url}/[slug].md`,
		`- Raw text artifacts: ${SITE.url}/[slug].txt`,
		'',
		'---',
		'',
		`Full sitemap: ${SITE.url}/sitemap.xml`,
		'',
	].join('\n');
};

export const isMarkdownNegotiablePath = (path: string): boolean => path === '/' || SLUG_PATH_PATTERN.test(path);

export const createMarkdownNegotiationResponse = async ({ request, url }: { request: Request; url: URL }): Promise<Response | null> => {
	if (!requestAcceptsMarkdown(request) || !isMarkdownNegotiablePath(url.pathname)) {
		return null;
	}

	if (url.pathname === '/') {
		const markdown = await buildHomeMarkdown();
		return createMarkdownResponse({ request, markdown });
	}

	const slugMatch = url.pathname.match(SLUG_PATH_PATTERN);
	if (!slugMatch) {
		return null;
	}

	const [, slug] = slugMatch;
	if (!slug) {
		return null;
	}

	const entry = await getPublicArtifactBySlug(slug);
	if (!entry) {
		return null;
	}

	return createMarkdownResponse({
		request,
		markdown: buildArtifactMarkdown(entry),
	});
};
