import crypto from 'node:crypto';
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

export const handle: Handle = async ({ event, resolve }) => {
	const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
	event.locals.nonce = nonce;

	const response = await resolve(event);
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

	if (response.status === 404 && !path.startsWith('/api')) {
		const redirectHeaders = new Headers(response.headers);
		redirectHeaders.set('location', '/');
		return new Response(null, { status: 302, headers: redirectHeaders });
	}

	return response;
};
