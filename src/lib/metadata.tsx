/**
 * Metadata Generators and Image Generators
 *
 * ## SUMMARY
 * Generator functions for Next.js metadata routes and static images.
 *
 * ## RESPONSIBILITIES
 * - Generate PWA manifest, robots.txt, and sitemap
 * - Generate favicons, Apple touch icon, and OG images at build time
 *
 * ## KEY FLOWS
 * Generates all metadata at build time using dynamic routes.
 *
 * @module lib/metadata
 */

import fs from 'node:fs';
import path from 'node:path';
import type { MetadataRoute } from 'next';
import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/constants';
import { logEvent } from '@/lib/logger';
import { getAllContent } from '@/lib/mdx';

// ============================================================================
// METADATA ROUTE GENERATORS
// ============================================================================

export function generateManifest(): MetadataRoute.Manifest {
	return {
		name: SITE.name,
		short_name: SITE.name,
		description: SITE.description,
		start_url: '/',
		display: 'standalone',
		background_color: SITE.backgroundColor,
		theme_color: SITE.themeColor,
		icons: [
			{
				src: '/icon/192',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/icon/512',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/icon/192',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'maskable',
			},
			{
				src: '/icon/512',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable',
			},
		],
		orientation: 'portrait',
		categories: ['design', 'creative', 'media'],
		lang: SITE.locale,
	};
}

export function generateRobots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
		},
		sitemap: `${SITE.url}/sitemap.xml`,
	};
}

/**
 * Generate sitemap with all content in all formats.
 * @returns Sitemap entries
 */
export async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
	try {
		const allContent = await getAllContent();

		const entries: MetadataRoute.Sitemap = [
			{
				url: SITE.url,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		];

		for (const item of allContent) {
			const { slug, date } = item.frontmatter;
			const lastMod = new Date(date);

			entries.push({
				url: `${SITE.url}/${slug}`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});

			entries.push({
				url: `${SITE.url}/${slug}.md`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});

			entries.push({
				url: `${SITE.url}/${slug}.txt`,
				lastModified: lastMod,
				changeFrequency: 'monthly',
			});
		}

		return entries;
	} catch (error) {
		logEvent('SITEMAP', 'GENERATE', 'FAIL', {
			error: error instanceof Error ? error.message : String(error),
			fallback: 'homepage-only',
		});

		return [
			{
				url: SITE.url,
				lastModified: new Date(),
				changeFrequency: 'monthly',
			},
		];
	}
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

let logoBufferCache: ArrayBuffer | null = null;

function getLogoBuffer(): ArrayBuffer {
	if (logoBufferCache) {
		return logoBufferCache;
	}

	const logoPath = path.join(process.cwd(), 'public', 'logo.png');

	try {
		if (!fs.existsSync(logoPath)) {
			logEvent('LOGO', 'LOAD', 'FAIL', { reason: 'file-not-found', path: logoPath });
			throw new Error(`Logo file not found: ${logoPath}`);
		}

		const buffer = fs.readFileSync(logoPath);

		if (buffer.length === 0) {
			logEvent('LOGO', 'LOAD', 'FAIL', { reason: 'empty-file', path: logoPath });
			throw new Error('Logo file is empty');
		}

		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength,
		);

		logoBufferCache = arrayBuffer;

		return arrayBuffer;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load logo: ${errorMessage}`);
	}
}

export const iconContentType = 'image/png';

const VALID_ICON_SIZES = [16, 32, 96, 192, 512] as const;

/**
 * Generate favicon PNG at specified size.
 * @param size - Icon dimensions
 * @throws {Error} If size is invalid
 */
export function Icon(size: number): ImageResponse {
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
			<img src={logoBuffer as unknown as string} width="512" height="512" alt={SITE.name} />
		</div>,
		{
			...ogSize,
		},
	);
}
