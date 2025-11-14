import type { MetadataRoute } from 'next';
import { generateRobots } from '@/lib/metadata';

/** Generate robots.txt at /robots.txt. */
export default async function robots(): Promise<MetadataRoute.Robots> {
	return generateRobots();
}
