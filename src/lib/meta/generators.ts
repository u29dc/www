/**
 * Metadata Generators
 *
 * ## SUMMARY
 * Provides generator functions for Next.js metadata routes (manifest, robots, sitemap) following Next.js file conventions.
 *
 * ## RESPONSIBILITIES
 * - Generate PWA manifest with dynamic icon references and robots.txt with sitemap URL
 * - Generate comprehensive sitemap for all content/formats with ISR (24h revalidation)
 *
 * ## USAGE
 * ```typescript
 * // Used by app/manifest.ts, app/robots.ts, app/sitemap.ts
 * import { generateManifest, generateRobots, generateSitemap } from '@/lib/meta/generators';
 *
 * export default function manifest() {
 *   return generateManifest();
 * }
 * ```
 *
 * ## KEY FLOWS
 * ### generateManifest()
 * Creates PWA manifest with site metadata, dynamic icon routes (any/maskable), and theme/display settings.
 *
 * ### generateRobots()
 * Allows all crawlers and references /sitemap.xml.
 *
 * ### generateSitemap()
 * Fetches MDX content and creates entries for homepage + all content in multiple formats (HTML, .md, .txt).
 *
 * @module lib/meta/generators
 */

import type { MetadataRoute } from 'next';
import { getAllContent } from '@/lib/mdx/aggregator';
import { SITE } from '@/lib/meta/config';
import { logEvent } from '@/lib/utils/logger';

/** Generate PWA manifest with dynamic icon routes. */
export function generateManifest(): MetadataRoute.Manifest {
	return {
		name: SITE.name,
		short_name: SITE.name,
		description: SITE.description,
		start_url: '/',
		display: 'standalone',
		background_color: SITE.backgroundColor,
		theme_color: SITE.themeColor,
		icons: [
			{
				src: '/icon/192',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/icon/512',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/icon/192',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'maskable',
			},
			{
				src: '/icon/512',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable',
			},
		],
		orientation: 'portrait',
		categories: ['design', 'creative', 'media'],
		lang: SITE.locale,
	};
}

/** Generate robots.txt allowing all crawlers. */
export function generateRobots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
		},
		sitemap: `${SITE.url}/sitemap.xml`,
	};
}

/** Generate sitemap with all content in all formats (HTML, .md, .txt). Includes ALL items regardless of isFeedItem. */
export async function generateSitemap(baseUrl: string): Promise<MetadataRoute.Sitemap> {
	try {
		// Fetch all content items
		const allContent = await getAllContent();

		// Initialize with homepage entry
		const entries: MetadataRoute.Sitemap = [
			{
				url: baseUrl,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		];

		// Add entries for ALL content (regardless of isFeedItem)
		for (const item of allContent) {
			const { slug, date } = item.frontmatter;
			const lastMod = new Date(date);

			// HTML page entry
			entries.push({
				url: `${baseUrl}/${slug}`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});

			// Raw markdown format entry
			entries.push({
				url: `${baseUrl}/${slug}.md`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});

			// Raw text format entry
			entries.push({
				url: `${baseUrl}/${slug}.txt`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});
		}

		return entries;
	} catch (error) {
		// Log failure with structured event
		logEvent('SITEMAP', 'GENERATE', 'FAIL', {
			error: error instanceof Error ? error.message : String(error),
			fallback: 'homepage-only',
		});

		// Fallback to homepage-only sitemap to ensure sitemap.xml always exists
		return [
			{
				url: baseUrl,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		];
	}
}
