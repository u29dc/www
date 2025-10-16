/**
 * Metadata Configuration
 *
 * ## SUMMARY
 * Centralizes Next.js metadata configuration (SEO, PWA, social sharing) and exports site constants, Metadata, and Viewport for app/layout.tsx.
 *
 * ## RESPONSIBILITIES
 * - Define site constants (title, description, URL) and export Metadata/Viewport objects for app/layout.tsx
 * - Configure SEO metadata (Open Graph, Twitter cards, robots directives, verification tokens)
 * - Reference dynamic routes for icons, manifest, and OG images (not static files)
 *
 * ## USAGE
 * ```typescript
 * // In app/layout.tsx
 * import { metadata, viewport } from '@/lib/meta/config';
 * export { metadata, viewport };
 * ```
 *
 * ## KEY FLOWS
 * All metadata assets (icons, OG images, manifest) use dynamic routes generated at build time, not static files.
 *
 * @module lib/meta/config
 */

import type { Metadata, Viewport } from 'next';

export const SITE = {
	title: 'Incomplete Infinity',
	name: 'Incomplete Infinity',
	description: 'We turn complex futures into decision-grade narratives and public prototypes',
	url: 'https://u29dc.com',
	locale: 'en-GB',
	themeColor: '#000000',
	backgroundColor: '#FFFFFF',
	keywords: ['design', 'creative', 'media'],
	creator: 'u29dc',
} as const;

export const CDN = {
	baseUrl: 'https://storage.u29dc.com',
	hostname: 'storage.u29dc.com',
	mediaPath: '/media/',
	get mediaUrl(): string {
		return `${this.baseUrl}${this.mediaPath}`;
	},
} as const;

export const viewport: Viewport = {
	themeColor: SITE.themeColor,
	width: 'device-width',
	initialScale: 1,
	maximumScale: 5,
	userScalable: true,
	viewportFit: 'cover',
};

/** Base metadata for all routes. Dynamic icon/manifest routes referenced. */
export const metadata: Metadata = {
	metadataBase: new URL(SITE.url),
	title: {
		default: SITE.title,
		template: `${SITE.name} | %s`,
	},
	description: SITE.description,
	applicationName: SITE.name,
	authors: [{ name: SITE.name, url: SITE.url }],
	keywords: [...SITE.keywords],
	referrer: 'origin-when-cross-origin',
	creator: SITE.name,
	publisher: SITE.name,
	category: 'technology',
	manifest: '/manifest.json',
	icons: {
		icon: [
			// SVG preferred by modern browsers (resolution-independent)
			{ url: '/favicon.svg', type: 'image/svg+xml' },
			// PNG fallbacks for different contexts
			{ url: '/icon', sizes: '16x16', type: 'image/png' },
			{ url: '/icon', sizes: '32x32', type: 'image/png' },
			{ url: '/icon', sizes: '96x96', type: 'image/png' },
			{ url: '/icon', sizes: '192x192', type: 'image/png' },
		],
		apple: '/apple-icon',
		other: [
			{
				rel: 'mask-icon',
				url: '/safari-pinned-tab.svg',
				color: SITE.themeColor,
			},
		],
	},
	openGraph: {
		title: SITE.title,
		description: SITE.description,
		url: SITE.url,
		siteName: SITE.name,
		images: [
			{
				url: '/opengraph-image',
				alt: SITE.name,
				width: 1200,
				height: 630,
				type: 'image/png',
			},
		],
		locale: SITE.locale,
		type: 'website',
	},
	twitter: {
		card: 'summary_large_image',
		creator: `@${SITE.creator}`,
	},
	appleWebApp: {
		title: SITE.name,
		statusBarStyle: 'default',
		capable: true,
	},
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	robots: {
		index: true,
		follow: true,
		nocache: false,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
	verification: {},
	alternates: {
		canonical: SITE.url,
	},
	other: {
		'color-scheme': 'light dark',
	},
};
