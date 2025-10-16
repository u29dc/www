/**
 * Generate favicons at multiple sizes using generateImageMetadata.
 * Generates 16x16, 32x32, 96x96, 192x192, and 512x512 variants.
 */

import type { ImageResponse } from 'next/og';
import { Icon, iconContentType } from '@/lib/meta/images';

export const contentType = iconContentType;

/**
 * Generate metadata for multiple icon sizes.
 * Each size is generated statically at build time.
 */
export function generateImageMetadata() {
	return [
		{ id: '16', size: { width: 16, height: 16 }, contentType: 'image/png' },
		{ id: '32', size: { width: 32, height: 32 }, contentType: 'image/png' },
		{ id: '96', size: { width: 96, height: 96 }, contentType: 'image/png' },
		{ id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
		{ id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
	];
}

/**
 * Generate icon image for the given size.
 * The id prop is provided by Next.js based on generateImageMetadata.
 */
export default async function IconRoute({ id }: { id: Promise<string> }): Promise<ImageResponse> {
	const iconId = await id;
	const size = Number.parseInt(iconId, 10);

	// Validate parsed size
	if (Number.isNaN(size)) {
		throw new Error(`Invalid icon ID: ${iconId}. Must be a valid integer.`);
	}

	// Icon() function will validate if size is in allowed list
	return Icon(size);
}

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
