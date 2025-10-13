import type { NextConfig } from 'next';
import { CDN } from '@/lib/utils/metadata';

const nextConfig: NextConfig = {
	reactCompiler: true,
	devIndicators: false,

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
	 * Maps /:slug.md and /:slug.txt URLs to universal raw API endpoint
	 * Enables serving MDX content as markdown (.md) or plain text (.txt)
	 */
	async rewrites() {
		return {
			beforeFiles: [
				{
					source: '/:slug.md',
					destination: '/api/raw/:slug',
				},
				{
					source: '/:slug.txt',
					destination: '/api/raw/:slug',
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
