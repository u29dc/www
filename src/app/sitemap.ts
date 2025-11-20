import type { MetadataRoute } from 'next';
import { generateSitemap } from '@/lib/metadata';

/** Generate sitemap.xml at /sitemap.xml. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	return generateSitemap();
}
