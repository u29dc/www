/** Generate sitemap.xml at /sitemap.xml with 24-hour ISR revalidation. */

import type { MetadataRoute } from 'next';
import { generateSitemap } from '@/lib/metadata';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	return await generateSitemap();
}
