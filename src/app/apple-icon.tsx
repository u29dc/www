import type { ImageResponse } from 'next/og';
import { AppleIcon, appleIconContentType, appleIconSize } from '@/lib/metadata';

export const contentType = appleIconContentType;
export const size = appleIconSize;

/** Generate 180x180 Apple touch icon at /apple-icon. */
export default async function AppleIconRoute(): Promise<ImageResponse> {
	return AppleIcon();
}
