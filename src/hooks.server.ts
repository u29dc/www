import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { CDN } from '$lib/constants';

const AGENT_UA_PATTERNS: RegExp[] = [
	/\bcurl\b/i,
	/\bwget\b/i,
	/\bhttpie\b/i,
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
];

const HTML_ALLOWLIST_UA_PATTERNS: RegExp[] = [
	/Googlebot/i,
	/Bingbot/i,
	/DuckDuckBot/i,
	/Slurp/i,
	/Twitterbot/i,
	/facebookexternalhit/i,
	/LinkedInBot/i,
	/Discordbot/i,
	/Slackbot/i,
	/WhatsApp/i,
	/TelegramBot/i,
];

const isAllowlistedUserAgent = (ua: string): boolean => HTML_ALLOWLIST_UA_PATTERNS.some((pattern) => pattern.test(ua));

const isAgentUserAgent = (ua: string): boolean => AGENT_UA_PATTERNS.some((pattern) => pattern.test(ua));

const prefersPlainText = (request: Request): boolean => {
	const accept = request.headers.get('accept') ?? '';
	if (!accept || accept === '*/*') return false;

	const types = accept.split(',').map((entry) => {
		const [type, ...params] = entry.trim().split(';');
		const qParam = params.find((p) => p.trim().startsWith('q='));
		const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
		return { type: type?.trim().toLowerCase() ?? '', q: Number.isNaN(q) ? 1 : q };
	});

	const htmlQ = types.find((t) => t.type === 'text/html' || t.type === 'application/xhtml+xml')?.q ?? 0;
	const plainQ = Math.max(types.find((t) => t.type === 'text/plain')?.q ?? 0, types.find((t) => t.type === 'text/markdown')?.q ?? 0);

	return plainQ > 0 && htmlQ === 0;
};

const getAgentRedirectTarget = (url: URL): string => {
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const slugMatch = path.match(/^\/([a-z0-9-]+)$/);
	const target = slugMatch ? `/${slugMatch[1]}.txt` : '/llms.txt';
	return url.search ? `${target}${url.search}` : target;
};

type CspDirective = {
	name: string;
	values: string[];
};

const buildCsp = (nonce: string): string => {
	const directives: CspDirective[] = [
		{ name: 'base-uri', values: ["'self'"] },
		{ name: 'default-src', values: ["'self'"] },
		{ name: 'connect-src', values: ["'self'"] },
		{ name: 'frame-ancestors', values: ["'none'"] },
		{ name: 'object-src', values: ["'none'"] },
		{ name: 'style-src', values: ["'self'", "'unsafe-inline'"] },
		{ name: 'media-src', values: ["'self'", CDN.baseUrl] },
		{ name: 'img-src', values: ["'self'", 'data:', 'blob:', CDN.baseUrl] },
		{ name: 'font-src', values: ["'self'", 'data:'] },
		{
			name: 'script-src',
			values: ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'", "'unsafe-inline'"] : [])],
		},
	];

	return directives
		.map((directive) => `${directive.name} ${directive.values.join(' ')}`)
		.join('; ')
		.concat('; upgrade-insecure-requests');
};

const createNonce = (): string => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

const shouldRedirectToHome = (path: string): boolean => {
	if (path.startsWith('/api')) return false;
	if (path.endsWith('.md') || path.endsWith('.txt')) return false;
	if (path === '/llms.txt' || path === '/sitemap.xml' || path === '/robots.txt' || path === '/manifest.json') return false;
	return !path.includes('.');
};

export const handle: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	const path = event.url.pathname;
	const userAgent = event.request.headers.get('user-agent') ?? '';

	if ((method === 'GET' || method === 'HEAD') && !path.startsWith('/api') && !path.endsWith('.txt') && !path.endsWith('.md') && !path.includes('.') && !isAllowlistedUserAgent(userAgent)) {
		if (isAgentUserAgent(userAgent) || prefersPlainText(event.request)) {
			return new Response(null, {
				status: 302,
				headers: {
					location: getAgentRedirectTarget(event.url),
					'cache-control': 'no-store',
				},
			});
		}
	}

	const nonce = createNonce();
	const requestId = crypto.randomUUID();
	event.locals.nonce = nonce;
	event.locals.requestId = requestId;

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace(/<script(?![^>]*nonce=)/g, `<script nonce="${nonce}"`),
	});

	response.headers.set('content-security-policy', buildCsp(nonce));

	if (!path.startsWith('/api')) {
		response.headers.set('x-frame-options', 'DENY');
		response.headers.set('x-content-type-options', 'nosniff');
		response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
		response.headers.set('permissions-policy', ['camera=()', 'microphone=()', 'geolocation=()', 'autoplay=()', 'fullscreen=(self)', 'picture-in-picture=()'].join(', '));

		const slugMatch = path.match(/^\/([a-z0-9-]+)$/);
		if (slugMatch) {
			const slug = slugMatch[1];
			response.headers.append('link', `</${slug}.txt>; rel="alternate"; type="text/plain"; title="${slug} text"`);
			response.headers.append('link', `</${slug}.md>; rel="alternate"; type="text/markdown"; title="${slug} markdown"`);
		} else {
			response.headers.append('link', '</llms.txt>; rel="alternate"; type="text/plain"; title="LLMS context"');
		}
	}

	response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

	if (response.status === 404 && shouldRedirectToHome(path)) {
		const redirectHeaders = new Headers(response.headers);
		redirectHeaders.set('location', '/');
		return new Response(null, { status: 302, headers: redirectHeaders });
	}

	return response;
};
