/**
 * Edge Proxy (Next.js 16 Convention)
 *
 * ## SUMMARY
 * Centralized security headers and Content Security Policy for all routes.
 * Renamed from middleware.ts to proxy.ts to clarify network boundary.
 *
 * ## RESPONSIBILITIES
 * - Generate nonce-backed Content Security Policy per request
 * - Apply security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
 * - Prevent XSS, clickjacking, and MIME-sniffing attacks
 *
 * ## KEY FLOWS
 * - Invoked automatically by Next.js for all non-static paths
 * - Shares CSP nonce with downstream components through `x-nonce` header
 * - Applies stricter headers to non-API routes
 *
 * @module src/proxy
 */

import { type NextRequest, NextResponse } from 'next/server';
import { CDN } from '@/lib/meta/config';
import type { CspDirective } from '@/lib/types/utils';
import { isValidTheme, RESOLVED_COOKIE, THEME_COOKIE } from '@/lib/utils/theme';

/**
 * Build a nonce-scoped Content Security Policy header for the incoming request.
 *
 * Uses cryptographic nonce to prevent XSS attacks while allowing inline scripts.
 * Environment-aware: relaxed in development, strict in production.
 *
 * @returns Object containing the serialized CSP header and generated nonce.
 */
export function generateCsp(): { cspHeader: string; nonce: string } {
	const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

	const cspDirectives: CspDirective[] = [
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
			values: [
				"'self'",
				`'nonce-${nonce}'`,
				...(process.env.NODE_ENV === 'development'
					? ["'unsafe-eval'", "'unsafe-inline'"]
					: []),
			],
		},
	];

	const cspHeader = cspDirectives
		.map((directive) => `${directive.name} ${directive.values.join(' ')}`)
		.join('; ')
		.concat('; upgrade-insecure-requests');

	return { cspHeader, nonce };
}

/**
 * Edge Proxy entry point (Next.js 16 convention).
 *
 * Renamed from `middleware` to `proxy` to clarify network boundary and routing focus.
 *
 * @param request - Incoming request intercepted by Next.js edge runtime.
 * @returns Response decorated with CSP and security headers.
 */
export async function proxy(request: NextRequest) {
	const { cspHeader, nonce } = generateCsp();

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set('x-nonce', nonce);

	// Handle theme preferences from cookies
	const themeCookie = request.cookies.get(THEME_COOKIE);
	const resolvedThemeCookie = request.cookies.get(RESOLVED_COOKIE);
	const theme = themeCookie?.value;
	const resolvedTheme = resolvedThemeCookie?.value;

	// Pass theme to layout via headers for server-side rendering
	// Validate theme value to prevent header injection
	if (theme && isValidTheme(theme)) {
		requestHeaders.set('x-theme', theme);
	} else {
		requestHeaders.set('x-theme', 'system');
	}

	// Pass resolved theme as well
	if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
		requestHeaders.set('x-resolved-theme', resolvedTheme);
	}

	const response = NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});

	// Apply CSP to all routes
	response.headers.set('content-security-policy', cspHeader);

	const path = request.nextUrl.pathname;

	// Apply stricter headers to non-API routes
	if (!path.startsWith('/api')) {
		response.headers.set('x-frame-options', 'DENY');
		response.headers.set('x-content-type-options', 'nosniff');
		response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
		response.headers.set(
			'permissions-policy',
			[
				'camera=()',
				'microphone=()',
				'geolocation=()',
				'autoplay=()',
				'fullscreen=(self)',
				'picture-in-picture=()',
			].join(', '),
		);
	}

	// HSTS: Force HTTPS for 1 year including subdomains
	response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

	return response;
}

export const config = {
	matcher: [
		// Match all paths except static assets and Next.js internals
		'/((?!_next/static|_next/image|favicon.ico).*)',
	],
};
