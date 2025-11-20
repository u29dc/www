import type { MetadataRoute } from 'next';
import { generateManifest } from '@/lib/metadata';

/** Generate PWA manifest at /manifest.json. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	return generateManifest();
}
