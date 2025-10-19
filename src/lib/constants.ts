/**
 * Site and Animation Constants
 *
 * ## SUMMARY
 * Next.js metadata configuration and animation timeline configurations.
 *
 * ## RESPONSIBILITIES
 * - Define site metadata for SEO, PWA, and social sharing
 * - Define animation timeline configurations for page transitions
 *
 * ## KEY FLOWS
 * All metadata assets use dynamic routes generated at build time.
 *
 * @module lib/constants
 */

import type { Metadata, Viewport } from 'next';
import type { TimelineConfig } from '@/lib/timeline';

// ==================================================
// SITE CONFIGURATION
// ==================================================

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

// Base metadata for all routes
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
			{ url: '/favicon.svg', type: 'image/svg+xml' },
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

// ==================================================
// ANIMATION TIMELINE CONFIGURATIONS
// ==================================================

// Index page timeline configuration
export const TIMELINE_INDEX: TimelineConfig = {
	id: 'index',
	enterStages: [
		{ id: 'index-title', duration: 1000, delay: 0 },
		{ id: 'index-description', duration: 500, delay: 0 },
		{ id: 'index-header-nav', duration: 200, delay: -100 },
		{ id: 'index-header', duration: 200, delay: -50 },
		{ id: 'index-feed', duration: 1000, delay: -200 },
	],
	exitStages: [
		{ id: 'index-feed', duration: 200, delay: -100 },
		{ id: 'index-header', duration: 200, delay: -100 },
		{ id: 'index-header-nav', duration: 200, delay: -100 },
		{ id: 'index-description', duration: 200, delay: -100 },
		{ id: 'index-title', duration: 200, delay: -100 },
	],
	enterSpeedMultiplier: 1,
	exitSpeedMultiplier: 2.0,
};

// Article/content page timeline configuration
export const TIMELINE_ARTICLE: TimelineConfig = {
	id: 'article',
	enterStages: [
		{ id: 'article-header-nav', duration: 200, delay: 0 },
		{ id: 'article-header', duration: 200, delay: -50 },
		{ id: 'article-body', duration: 500, delay: -250 },
	],
	exitStages: [
		{ id: 'article-body', duration: 200, delay: -100 },
		{ id: 'article-header', duration: 200, delay: -100 },
		{ id: 'article-header-nav', duration: 200, delay: -100 },
	],
	enterSpeedMultiplier: 1,
	exitSpeedMultiplier: 2.0,
};
