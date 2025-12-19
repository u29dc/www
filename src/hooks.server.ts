import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { CDN } from '$lib/constants';

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

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = (bytes: Uint8Array): string => {
	let output = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;
		const triple = (a << 16) | (b << 8) | c;
		output += BASE64_ALPHABET[(triple >> 18) & 63];
		output += BASE64_ALPHABET[(triple >> 12) & 63];
		output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=';
		output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '=';
	}
	return output;
};

const createNonce = (): string => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return bytesToBase64(bytes);
};

const shouldRedirectToHome = (path: string): boolean => {
	if (path.startsWith('/api')) return false;
	if (path.endsWith('.md') || path.endsWith('.txt')) return false;
	if (path === '/llms.txt' || path === '/sitemap.xml' || path === '/robots.txt' || path === '/manifest.json') return false;
	return !path.includes('.');
};

export const handle: Handle = async ({ event, resolve }) => {
	const nonce = createNonce();
	event.locals.nonce = nonce;

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace(/<script(?![^>]*nonce=)/g, `<script nonce="${nonce}"`),
	});
	const path = event.url.pathname;

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
