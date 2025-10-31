import type { NextConfig } from 'next';
import { CDN } from '@/lib/constants';

const nextConfig: NextConfig = {
	reactCompiler: true,
	devIndicators: false,
	experimental: {
		mcpServer: true,
	},
	cacheComponents: false,

	env: {
		NEXT_PUBLIC_COMMIT_SHA: process.env['VERCEL_GIT_COMMIT_SHA'] || undefined,
	},

	/**
	 * Security headers applied to all routes
	 *
	 * Note: Edge proxy (src/proxy.ts) provides primary security layer with CSP.
	 * These headers serve as fallback for static routes and CDN-cached content.
	 */
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
				],
			},
		];
	},

	/**
	 * URL rewrites for raw content endpoints
	 *
	 * Maps /:slug.md and /:slug.txt URLs to format-specific API routes.
	 * Uses afterFiles to allow Next.js convention files (robots.txt, etc.) to be served first.
	 */
	async rewrites() {
		return {
			afterFiles: [
				{
					source: '/:slug.md',
					destination: '/api/raw/md/:slug',
				},
				{
					source: '/:slug.txt',
					destination: '/api/raw/txt/:slug',
				},
			],
		};
	},

	images: {
		remotePatterns: [{ protocol: 'https', hostname: CDN.hostname }],
		localPatterns: [{ pathname: '/public/**', search: '' }],
	},
};

export default nextConfig;
