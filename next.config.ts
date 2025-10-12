import type { NextConfig } from 'next';

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

	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: 'images.unsplash.com' },
			{ protocol: 'https', hostname: 'storage.u29dc.com' },
		],
		localPatterns: [{ pathname: '/public/**', search: '' }],
	},
};

export default nextConfig;
