import type { ImageResponse } from 'next/og';
import { BaseOGImage, ogAlt, ogContentType, ogSize } from '@/lib/metadata';

export const alt = ogAlt;
export const contentType = ogContentType;
export const size = ogSize;

/** Generate 1200x630 base OG image at /opengraph-image. */
export default async function OpenGraphImage(): Promise<ImageResponse> {
	return BaseOGImage();
}
