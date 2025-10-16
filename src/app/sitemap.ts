/** Generate sitemap.xml at /sitemap.xml. */

import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/meta/config';
import { generateSitemap } from '@/lib/meta/generators';

// ISR configuration: revalidate every 24 hours
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	return await generateSitemap(SITE.url);
}
