/** Generate 1200x630 base OG image at /opengraph-image. */

export {
	BaseOGImage as default,
	ogAlt as alt,
	ogContentType as contentType,
	ogSize as size,
} from '@/lib/metadata';

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
