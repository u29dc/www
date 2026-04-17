import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { CDN } from '$lib/constants';
import { appendVaryHeader, CONTENT_SIGNAL_POLICY } from '$lib/server/agent-policy';
import { type AgentRedirectClassification, type AgentRedirectMode, classifyAgentRedirectRequest, parseAgentRedirectMode } from '$lib/server/classifier';
import { logEvent } from '$lib/server/logger';
import { createMarkdownNegotiationResponse, isMarkdownNegotiablePath } from '$lib/server/markdown-negotiation';

type RuntimeEnv = {
	AGENT_REDIRECT_MODE: string | null;
	AGENT_REDIRECT_DEBUG: string | null;
};

type ProcessRuntimeEnv = {
	AGENT_REDIRECT_MODE?: string;
	AGENT_REDIRECT_DEBUG?: string;
};

const getAgentRedirectTarget = (url: URL): string => {
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const slugMatch = path.match(/^\/([a-z0-9-]+)$/);
	const target = slugMatch ? `/${slugMatch[1]}.txt` : '/llms.txt';
	return url.search ? `${target}${url.search}` : target;
};

const getProcessRuntimeEnv = (): ProcessRuntimeEnv | undefined => {
	if (typeof process === 'undefined') return undefined;
	return process.env as ProcessRuntimeEnv;
};

const getStringBinding = (value: unknown): string | undefined => {
	if (typeof value === 'string') return value;
	return undefined;
};

const getRuntimeEnv = (platformEnv: Record<string, unknown> | undefined): RuntimeEnv => {
	const processEnv = getProcessRuntimeEnv();

	return {
		AGENT_REDIRECT_MODE: getStringBinding(platformEnv?.['AGENT_REDIRECT_MODE']) ?? processEnv?.AGENT_REDIRECT_MODE ?? null,
		AGENT_REDIRECT_DEBUG: getStringBinding(platformEnv?.['AGENT_REDIRECT_DEBUG']) ?? processEnv?.AGENT_REDIRECT_DEBUG ?? null,
	};
};

const getAgentRedirectMode = (env: RuntimeEnv): AgentRedirectMode => parseAgentRedirectMode(env.AGENT_REDIRECT_MODE);

const isAgentDebugEnabled = (env: RuntimeEnv): boolean => {
	const value = env.AGENT_REDIRECT_DEBUG;
	if (!value) return false;

	switch (value.trim().toLowerCase()) {
		case '1':
		case 'true':
		case 'on':
		case 'yes':
			return true;
		default:
			return false;
	}
};

const setAgentDebugHeaders = ({ headers, mode, classification }: { headers: Headers; mode: AgentRedirectMode; classification: AgentRedirectClassification }): void => {
	headers.set('x-agent-mode', mode);
	headers.set('x-agent-decision', classification.shouldRedirect ? 'redirect' : 'html');
	headers.set('x-agent-confidence', classification.confidence);
	headers.set('x-agent-reasons', classification.reasonCodes.join(','));
	headers.set('x-agent-accept-plain', classification.acceptPrefersPlainText ? '1' : '0');

	if (classification.agentPatternId) {
		headers.set('x-agent-agent-pattern', classification.agentPatternId);
	}

	if (classification.allowlistPatternId) {
		headers.set('x-agent-allowlist-pattern', classification.allowlistPatternId);
	}

	if (classification.browserSignals.length > 0) {
		headers.set('x-agent-browser-signals', classification.browserSignals.join(','));
	}
};

const shouldLogAgentDecision = ({ mode, classification }: { mode: AgentRedirectMode; classification: AgentRedirectClassification }): boolean =>
	classification.eligible && (mode !== 'off' || classification.wouldRedirect || classification.acceptPrefersPlainText);

const getAgentDecisionResult = (classification: AgentRedirectClassification): string => {
	if (classification.shouldRedirect) return 'REDIRECT';
	if (classification.wouldRedirect) return 'CANDIDATE';
	return 'PASS';
};

const logAgentDecision = ({
	requestId,
	path,
	method,
	mode,
	classification,
}: {
	requestId: string;
	path: string;
	method: string;
	mode: AgentRedirectMode;
	classification: AgentRedirectClassification;
}): void => {
	if (!shouldLogAgentDecision({ mode, classification })) return;

	logEvent('AGENT_REDIRECT', 'CLASSIFY', getAgentDecisionResult(classification), {
		requestId,
		path,
		method,
		mode,
		confidence: classification.confidence,
		reasonCodes: classification.reasonCodes,
		agentPatternId: classification.agentPatternId,
		allowlistPatternId: classification.allowlistPatternId,
		browserSignals: classification.browserSignals,
	});
};

const createAgentRedirectResponse = ({
	url,
	mode,
	classification,
	debugAgentHeaders,
}: {
	url: URL;
	mode: AgentRedirectMode;
	classification: AgentRedirectClassification;
	debugAgentHeaders: boolean;
}): Response => {
	const headers = new Headers({
		location: getAgentRedirectTarget(url),
		'cache-control': 'no-store',
	});

	if (debugAgentHeaders) {
		setAgentDebugHeaders({ headers, mode, classification });
	}

	return new Response(null, {
		status: 302,
		headers,
	});
};

const applySecurityHeaders = (response: Response, path: string): void => {
	if (path.startsWith('/api')) return;

	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('content-signal', CONTENT_SIGNAL_POLICY);
	response.headers.set('permissions-policy', ['camera=()', 'microphone=()', 'geolocation=()', 'autoplay=()', 'fullscreen=(self)', 'picture-in-picture=()'].join(', '));

	const slugMatch = path.match(/^\/([a-z0-9-]+)$/);
	if (slugMatch) {
		const slug = slugMatch[1];
		response.headers.append('link', `</${slug}.txt>; rel="alternate"; type="text/plain"; title="${slug} text"`);
		response.headers.append('link', `</${slug}.md>; rel="alternate"; type="text/markdown"; title="${slug} markdown"`);
		return;
	}

	response.headers.append('link', '</llms.txt>; rel="alternate"; type="text/plain"; title="LLMS context"');
};

const applyNegotiationCacheHeaders = (response: Response): void => {
	response.headers.set('cache-control', 'private, no-store, must-revalidate');
	response.headers.set('cdn-cache-control', 'no-store');
	response.headers.set('cloudflare-cdn-cache-control', 'no-store');
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
	const path = event.url.pathname;
	const platform = event.platform as { env?: Record<string, unknown> } | undefined;
	const runtimeEnv = getRuntimeEnv(platform?.env);
	const mode = getAgentRedirectMode(runtimeEnv);
	const debugAgentHeaders = isAgentDebugEnabled(runtimeEnv);
	const requestId = crypto.randomUUID();
	event.locals.requestId = requestId;

	const markdownResponse = await createMarkdownNegotiationResponse({
		request: event.request,
		url: event.url,
	});

	if (markdownResponse) {
		applySecurityHeaders(markdownResponse, path);
		applyNegotiationCacheHeaders(markdownResponse);
		markdownResponse.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
		return markdownResponse;
	}

	const classification = classifyAgentRedirectRequest({
		request: event.request,
		path,
		mode,
	});

	logAgentDecision({
		requestId,
		path,
		method: event.request.method,
		mode,
		classification,
	});

	if (classification.shouldRedirect) {
		return createAgentRedirectResponse({
			url: event.url,
			mode,
			classification,
			debugAgentHeaders,
		});
	}

	const nonce = createNonce();
	event.locals.nonce = nonce;

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace(/<script(?![^>]*nonce=)/g, `<script nonce="${nonce}"`),
	});

	response.headers.set('content-security-policy', buildCsp(nonce));
	applySecurityHeaders(response, path);
	if (isMarkdownNegotiablePath(path)) {
		appendVaryHeader(response.headers, 'Accept');
		applyNegotiationCacheHeaders(response);
	}

	response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

	if (debugAgentHeaders && classification.eligible) {
		setAgentDebugHeaders({ headers: response.headers, mode, classification });
	}

	if (response.status === 404 && shouldRedirectToHome(path)) {
		const redirectHeaders = new Headers(response.headers);
		redirectHeaders.set('location', '/');
		return new Response(null, { status: 302, headers: redirectHeaders });
	}

	return response;
};
