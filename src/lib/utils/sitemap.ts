/**
 * Sitemap Generation Utility
 *
 * ## SUMMARY
 * Provides reusable functions for generating comprehensive sitemap data from content.
 * Used by both app/sitemap.ts (Next.js convention) and raw API routes for llms.txt injection.
 * Generates entries for ALL content in ALL formats (HTML pages + raw .md + .txt files).
 *
 * ## RESPONSIBILITIES
 * - Generate sitemap entries for homepage and all content items
 * - Create entries for all content formats: HTML (/{slug}), Markdown (/{slug}.md), Text (/{slug}.txt)
 * - Convert entries to XML format for embedding in text files
 * - Maintain consistent sitemap structure across application
 * - Follow sitemaps.org specification for XML format
 *
 * ## USAGE
 * ```typescript
 * import { generateSitemapEntries, generateSitemapXML } from '@/lib/utils/sitemap';
 *
 * // Generate structured sitemap entries
 * const entries = await generateSitemapEntries('https://u29dc.com');
 *
 * // Convert to XML string for embedding
 * const xml = generateSitemapXML(entries);
 * ```
 *
 * ## KEY FLOWS
 * ### generateSitemapEntries()
 * 1. Fetch all content using getAllContent()
 * 2. Create homepage entry with current date
 * 3. For each content item:
 *    - Extract slug and date from frontmatter
 *    - Create HTML page entry (/{slug})
 *    - Create markdown entry (/{slug}.md)
 *    - Create text entry (/{slug}.txt)
 * 4. Return complete array of sitemap entries
 *
 * ### generateSitemapXML()
 * 1. Map each entry to XML <url> element
 * 2. Format lastModified date as YYYY-MM-DD
 * 3. Wrap entries in <urlset> with xmlns attribute
 * 4. Return formatted XML string
 *
 * @module lib/utils/sitemap
 */

import type { MetadataRoute } from 'next';
import { getAllContent } from '@/lib/mdx/aggregator';

/**
 * Generates comprehensive sitemap entries for all content and formats
 *
 * Creates sitemap entries for:
 * - Homepage (baseUrl)
 * - All HTML pages (/{slug})
 * - All raw markdown files (/{slug}.md)
 * - All raw text files (/{slug}.txt)
 *
 * Does NOT filter by isFeedItem - includes ALL content regardless of feed status.
 *
 * @param baseUrl - Base URL for the site (e.g., 'https://u29dc.com')
 * @returns Promise resolving to array of sitemap entries compatible with Next.js MetadataRoute.Sitemap
 *
 * @example
 * ```typescript
 * const entries = await generateSitemapEntries('https://u29dc.com');
 * // Returns entries for:
 * // - https://u29dc.com
 * // - https://u29dc.com/page
 * // - https://u29dc.com/page.md
 * // - https://u29dc.com/page.txt
 * // ... (for all content items)
 * ```
 */
export async function generateSitemapEntries(baseUrl: string): Promise<MetadataRoute.Sitemap> {
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
}

/**
 * Escape special XML characters to prevent injection and ensure spec compliance
 *
 * @param str - String to escape
 * @returns XML-safe string with special characters escaped
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Converts sitemap entries to XML string format
 *
 * Transforms structured sitemap entries into XML format following sitemaps.org specification.
 * Uses minimal format (url + lastmod only) per Google's current guidelines.
 * Date formatting follows ISO 8601 date format (YYYY-MM-DD).
 *
 * @param entries - Array of sitemap entries from generateSitemapEntries()
 * @returns XML string with urlset wrapper and properly formatted entries
 *
 * @example
 * ```typescript
 * const entries = await generateSitemapEntries('https://u29dc.com');
 * const xml = generateSitemapXML(entries);
 * // Returns:
 * // <?xml version="1.0" encoding="UTF-8"?>
 * // <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 * //   <url>
 * //     <loc>https://u29dc.com</loc>
 * //     <lastmod>2025-10-13</lastmod>
 * //   </url>
 * //   ...
 * // </urlset>
 * ```
 */
export function generateSitemapXML(entries: MetadataRoute.Sitemap): string {
	// Map entries to XML url elements
	const urlEntries = entries
		.map((entry) => {
			// Format lastModified as YYYY-MM-DD
			const lastmod =
				entry.lastModified instanceof Date
					? entry.lastModified.toISOString().split('T')[0]
					: entry.lastModified;

			return `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
		})
		.join('\n');

	// Wrap in urlset with xmlns attribute
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}
