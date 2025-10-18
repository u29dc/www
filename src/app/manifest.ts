/** Generate PWA manifest at /manifest.json. */

export { generateManifest as default } from '@/lib/metadata';

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
