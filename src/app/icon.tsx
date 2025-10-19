/** Generate favicons at multiple sizes (16, 32, 96, 192, 512). */

import type { ImageResponse } from 'next/og';
import { Icon, iconContentType } from '@/lib/metadata';

export const contentType = iconContentType;

export function generateImageMetadata() {
	return [
		{ id: '16', size: { width: 16, height: 16 }, contentType: 'image/png' },
		{ id: '32', size: { width: 32, height: 32 }, contentType: 'image/png' },
		{ id: '96', size: { width: 96, height: 96 }, contentType: 'image/png' },
		{ id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
		{ id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
	];
}

export default async function IconRoute({ id }: { id: Promise<string> }): Promise<ImageResponse> {
	const iconId = await id;
	const size = Number.parseInt(iconId, 10);

	if (Number.isNaN(size)) {
		throw new Error(`Invalid icon ID: ${iconId}. Must be a valid integer.`);
	}

	return Icon(size);
}

// Force static generation at build time
export const dynamic = 'force-static';
export const revalidate = false;
