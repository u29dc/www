/**
 * SEO & PWA Metadata Configuration
 *
 * ## SUMMARY
 * Centralizes Next.js metadata defaults for consistent SEO, PWA support, and social sharing
 * across all routes. Provides base configuration that can be extended at the route level.
 *
 * ## RESPONSIBILITIES
 * - Define canonical titles, descriptions, and asset references
 * - Maintain Open Graph and Twitter card configuration
 * - Publish viewport and PWA manifest directives
 * - Configure multi-format favicon suite
 * - Set SEO robots directives and canonical URLs
 *
 * ## KEY FLOWS
 * - Imported by `app/layout.tsx` to export base metadata
 * - Can be spread by route-level modules when extending metadata
 *
 * ## USAGE
 * ```typescript
 * // In app/layout.tsx (base metadata)
 * import { metadata, viewport } from '@/lib/utils/metadata';
 * export { metadata, viewport };
 *
 * // In a specific route (extending metadata)
 * import { metadata as baseMetadata, viewport } from '@/lib/utils/metadata';
 * export { viewport };
 * export const metadata: Metadata = {
 *   ...baseMetadata,
 *   title: 'Custom Page Title',
 *   description: 'Custom page description',
 * };
 * ```
 *
 * ## DEPENDENCIES
 * - Uses Next.js built-in `Metadata` and `Viewport` types (no external dependencies)
 *
 * @module lib/utils/metadata
 * @see app/layout.tsx
 */

import type { Metadata, Viewport } from 'next';

const SITE = {
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

const CDN = {
	baseUrl: 'https://storage.u29dc.com',
	hostname: 'storage.u29dc.com',
	mediaPath: '/media/',
	get mediaUrl(): string {
		return `${this.baseUrl}${this.mediaPath}`;
	},
} as const;

const sharedImages = [
	{
		url: '/meta/og-image.png',
		alt: `${SITE.name} - ${SITE.description}`,
		width: 1200,
		height: 630,
		type: 'image/png',
	},
	{
		url: '/meta/og-image-square.png',
		alt: `${SITE.name} - ${SITE.description}`,
		width: 1200,
		height: 1200,
		type: 'image/png',
	},
] as const;

export const viewport: Viewport = {
	themeColor: SITE.themeColor,
	width: 'device-width',
	initialScale: 1,
	maximumScale: 5,
	userScalable: true,
	viewportFit: 'cover',
};

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
	classification: '',
	manifest: '/manifest.json',
	icons: {
		icon: [
			{ url: '/meta/favicon.svg', type: 'image/svg+xml' },
			{ url: '/meta/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
			{ url: '/meta/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/meta/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
		],
		shortcut: '/meta/favicon.ico',
		apple: '/meta/apple-touch-icon.png',
		other: [
			{
				rel: 'mask-icon',
				url: '/meta/safari-pinned-tab.svg',
				color: SITE.themeColor,
			},
		],
	},
	openGraph: {
		title: SITE.title,
		description: SITE.description,
		url: SITE.url,
		siteName: SITE.name,
		images: [...sharedImages],
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
		startupImage: ['/meta/apple-touch-icon.png'],
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

export { SITE, CDN };
