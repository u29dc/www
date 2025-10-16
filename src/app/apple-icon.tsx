/** Generate 180x180 Apple touch icon at /apple-icon. */

export {
	AppleIcon as default,
	appleIconContentType as contentType,
	appleIconSize as size,
} from '@/lib/meta/images';

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
