/**
 * Next.js Sitemap Convention File
 *
 * SUMMARY
 * Generates dynamic XML sitemap served at /sitemap.xml using Next.js file convention.
 * Includes ALL content in ALL formats (HTML pages + raw .md/.txt versions).
 *
 * RESPONSIBILITIES
 * - Generate comprehensive sitemap for entire site
 * - Include static pages (homepage) and dynamic content
 * - Respect ISR caching with 24-hour revalidation
 *
 * USAGE
 * Automatically served by Next.js at /sitemap.xml
 * No manual invocation required
 *
 * KEY FLOWS
 * 1. Next.js receives request for /sitemap.xml
 * 2. Calls sitemap() function to generate entries
 * 3. Utility aggregates all content and formats
 * 4. Returns structured sitemap array
 * 5. Next.js converts to XML and serves
 */

import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/utils/metadata';
import { generateSitemapEntries } from '@/lib/utils/sitemap';

// ISR configuration: revalidate every 24 hours
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	return await generateSitemapEntries(SITE.url);
}
