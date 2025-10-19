/**
 * MDX Client Utilities
 *
 * ## SUMMARY
 * Client-safe utilities for extracting media references from MDX content.
 *
 * ## RESPONSIBILITIES
 * - Parse MdxMedia component syntax from content strings
 * - Extract and validate media filenames
 * - Classify media types (image/video)
 *
 * @module lib/mdx-client
 */

import { CDN } from '@/lib/constants';
import { logEvent } from '@/lib/logger';

// ==================================================
// TYPE DEFINITIONS
// ==================================================

export interface MediaItem {
	filename: string;
	type: 'image' | 'video';
	extension: string;
}

// ==================================================
// MEDIA EXTRACTION
// ==================================================

const IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.gif'];
const ALLOWED_MEDIA_EXTENSIONS = ['.webp', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.mp4'];
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/;

/**
 * Determines media type (image or video) from filename extension
 * @param filename - Media filename with extension
 * @returns 'image' | 'video' | null if invalid
 */
export function getMediaType(filename: string): 'image' | 'video' | null {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1) return null;

	const extension = filename.substring(lastDot).toLowerCase();
	if (!ALLOWED_MEDIA_EXTENSIONS.includes(extension)) return null;

	return IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'video';
}

export function sanitizeMediaFilename(filename: string): string | null {
	if (!SAFE_FILENAME_PATTERN.test(filename)) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'INVALID_PATTERN', {
			filename: filename.substring(0, 50),
		});
		return null;
	}

	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'NO_EXTENSION', { filename });
		return null;
	}

	const ext = filename.substring(lastDot).toLowerCase();
	if (!ALLOWED_MEDIA_EXTENSIONS.includes(ext)) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'INVALID_EXTENSION', {
			filename,
			extension: ext,
			allowed: ALLOWED_MEDIA_EXTENSIONS,
		});
		return null;
	}

	return filename;
}

function parseMediaSrcArray(srcArray: string, matchContext: string): string[] | null {
	try {
		const normalizedArray = srcArray.replace(/'/g, '"');
		const parsed = JSON.parse(normalizedArray);

		if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
			logEvent('MDX', 'EXTRACT_MEDIA', 'INVALID_ARRAY', {
				match: matchContext,
			});
			return null;
		}

		return parsed;
	} catch (error) {
		logEvent('MDX', 'EXTRACT_MEDIA', 'PARSE_FAIL', {
			error: error instanceof Error ? error.message : String(error),
			match: matchContext,
		});
		return null;
	}
}

function createMediaItem(filename: string): MediaItem | null {
	const sanitized = sanitizeMediaFilename(filename);
	if (!sanitized) return null;

	const lastDot = sanitized.lastIndexOf('.');
	const extension = sanitized.substring(lastDot).toLowerCase();
	const type: 'image' | 'video' = IMAGE_EXTENSIONS.includes(extension) ? 'image' : 'video';

	return { filename: sanitized, type, extension };
}

/**
 * Extracts all image and video links from MDX content.
 * @param content - Raw MDX content string
 * @returns Array of media items with filename, type, and extension
 */
export function extractMediaFromContent(content: string): MediaItem[] {
	const mediaItems: MediaItem[] = [];
	const regex = /<MdxMedia\s+src=\{(\[[^\]]*\])\}\s*\/>/g;
	const matches = content.matchAll(regex);

	for (const match of matches) {
		const srcArray = match[1];
		if (!srcArray) continue;

		const sources = parseMediaSrcArray(srcArray, match[0].substring(0, 100));
		if (!sources) continue;

		for (const src of sources) {
			const mediaItem = createMediaItem(src);
			if (mediaItem) {
				mediaItems.push(mediaItem);
			}
		}
	}

	logEvent('MDX', 'EXTRACT_MEDIA', 'SUCCESS', {
		count: mediaItems.length,
	});

	return mediaItems;
}

// Re-export CDN for use in markdown transformation
export { CDN };
