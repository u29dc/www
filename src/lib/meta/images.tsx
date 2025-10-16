/**
 * Metadata Image Generators
 *
 * ## SUMMARY
 * Generates static metadata images (favicons, Apple touch icon, OG images) at build time using Next.js ImageResponse.
 *
 * ## RESPONSIBILITIES
 * - Load and cache logo buffer from public/logo.png using fs.readFileSync
 * - Generate favicons (16/32/96/192/512), Apple touch icon (180), and OG images (1200x630) using ImageResponse/Satori with <img> elements
 *
 * ## USAGE
 * ```tsx
 * // In app/icon.tsx with generateImageMetadata
 * import { Icon } from '@/lib/meta/images';
 * export default async function IconRoute({ id }) {
 *   const size = Number.parseInt(await id, 10);
 *   return Icon(size);
 * }
 *
 * // In app/opengraph-image.tsx
 * import { BaseOGImage } from '@/lib/meta/images';
 * export default BaseOGImage;
 * ```
 *
 * ## KEY FLOWS
 * ### getLogoBuffer()
 * Loads public/logo.png (512x512 PNG with alpha) as cached ArrayBuffer for ImageResponse compatibility.
 *
 * ### Icon(size)
 * Returns ImageResponse at specified size (16/32/96/192/512) for generateImageMetadata favicon variants.
 *
 * ### AppleIcon / BaseOGImage / ContentOGImage
 * Generate 180x180 Apple touch icon and 1200x630 OG images with centered logo on black background.
 *
 * ## TECHNICAL CONSTRAINTS
 * ImageResponse uses Satori (no Canvas/WebGL), requires ArrayBuffer for images (not file paths), system fonts only (sans-serif), PNG format only.
 *
 * @module lib/meta/images
 */

import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/meta/config';
import { logEvent } from '@/lib/utils/logger';

/**
 * Cached logo buffer to avoid repeated file reads
 */
let logoBufferCache: ArrayBuffer | null = null;

/**
 * Load logo from public/meta as ArrayBuffer. Cached on first access.
 * Uses fs.readFileSync as icon routes are pre-rendered at build time.
 */
function getLogoBuffer(): ArrayBuffer {
	if (logoBufferCache) {
		return logoBufferCache;
	}

	// Resolve path to logo file in public directory
	// This file must not be deleted - it's the source for all icon generation
	const logoPath = path.join(process.cwd(), 'public', 'logo.png');

	try {
		// Verify file exists before attempting read
		if (!fs.existsSync(logoPath)) {
			logEvent('LOGO', 'LOAD', 'FAIL', { reason: 'file-not-found', path: logoPath });
			throw new Error(`Logo file not found: ${logoPath}`);
		}

		// Read file synchronously (safe during build-time execution)
		const buffer = fs.readFileSync(logoPath);

		// Validate buffer is not empty
		if (buffer.length === 0) {
			logEvent('LOGO', 'LOAD', 'FAIL', { reason: 'empty-file', path: logoPath });
			throw new Error('Logo file is empty');
		}

		// Convert Node.js Buffer to ArrayBuffer
		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength,
		);

		// Cache for future use
		logoBufferCache = arrayBuffer;

		return arrayBuffer;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load logo: ${errorMessage}`);
	}
}

export const iconContentType = 'image/png';

/** Valid icon sizes for favicon generation */
const VALID_ICON_SIZES = [16, 32, 96, 192, 512] as const;

/**
 * Generate favicon PNG at specified size.
 * Used with generateImageMetadata to create multiple icon variants.
 *
 * @param size - Icon dimensions (must be one of: 16, 32, 96, 192, 512)
 * @throws Error if size is invalid
 */
export function Icon(size: number): ImageResponse {
	// Validate size is in allowed list
	if (!VALID_ICON_SIZES.includes(size as (typeof VALID_ICON_SIZES)[number])) {
		throw new Error(
			`Invalid icon size: ${size}. Must be one of: ${VALID_ICON_SIZES.join(', ')}`,
		);
	}

	const logoBuffer = getLogoBuffer();

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#000000',
			}}
		>
			{/* Satori requires ArrayBuffer cast to string for img src */}
			<img src={logoBuffer as unknown as string} width={size} height={size} alt={SITE.name} />
		</div>,
		{
			width: size,
			height: size,
		},
	);
}

export const appleIconSize = { width: 180, height: 180 };

export const appleIconContentType = 'image/png';

/** Generate 180x180 Apple touch icon PNG. */
export function AppleIcon(): ImageResponse {
	const logoBuffer = getLogoBuffer();

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#000000',
			}}
		>
			{/* Satori requires ArrayBuffer cast to string for img src */}
			<img src={logoBuffer as unknown as string} width="180" height="180" alt={SITE.name} />
		</div>,
		{
			...appleIconSize,
		},
	);
}

export const ogSize = { width: 1200, height: 630 };

export const ogContentType = 'image/png';

export const ogAlt = SITE.name;

/** Generate 1200x630 base OG image with centered logo. */
export function BaseOGImage(): ImageResponse {
	const logoBuffer = getLogoBuffer();

	return new ImageResponse(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#000000',
			}}
		>
			{/* Satori requires ArrayBuffer cast to string for img src */}
			<img src={logoBuffer as unknown as string} width="512" height="512" alt={SITE.name} />
		</div>,
		{
			...ogSize,
		},
	);
}
