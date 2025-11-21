'use client';

/**
 * Content Index Artifacts Item Thumbnails
 *
 * ## SUMMARY
 * Client component rendering horizontal thumbnail row with deterministic preset selection.
 *
 * ## RESPONSIBILITIES
 * - Render horizontal row of thumbnails with varied aspect ratios
 * - Use hash-based preset selection for deterministic variation
 * - Implement lazy loading and hover-based video autoplay
 * - Support configurable maxItems limit
 *
 * @module components/content/content-index-artifacts-item-thumbnails
 */

import { useEffect, useRef } from 'react';
import { AtomicImage, AtomicVideo } from '@/components/atomic/atomic-media';
import { CDN } from '@/lib/constants';
import type { MediaItem } from '@/lib/mdx-client';

// ==================================================
// TYPE DEFINITIONS
// ==================================================

interface AspectRatioPreset {
	ratio: string;
	heightScale: number;
}

export interface ContentIndexArtifactsItemThumbnailsProps {
	mediaItems: MediaItem[];
	slug: string;
	maxItems?: number;
	isHovered: boolean;
}

// ==================================================
// PRESET CONFIGURATION
// ==================================================

const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
	{ ratio: '16/9', heightScale: 1.0 },
	{ ratio: '3/4', heightScale: 1.5 },
	{ ratio: '21/9', heightScale: 1.25 },
];

// ==================================================
// DETERMINISTIC HASH FUNCTION
// ==================================================

/**
 * Simple hash function to convert string to number
 * Uses djb2 algorithm for consistent results
 */
function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) + hash + str.charCodeAt(i);
	}
	return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Deterministically select preset based on slug and filename
 */
function selectPreset(slug: string, filename: string): AspectRatioPreset {
	const hash = hashString(`${slug}-${filename}`);
	const presetIndex = hash % ASPECT_RATIO_PRESETS.length;
	return ASPECT_RATIO_PRESETS[presetIndex] as AspectRatioPreset;
}

// ==================================================
// COMPONENT
// ==================================================

/**
 * Renders horizontal thumbnail row with deterministic preset selection
 *
 * @param mediaItems - Array of media items to display
 * @param slug - Content slug for deterministic hashing
 * @param maxItems - Maximum thumbnails to display (0 = unlimited)
 * @param isHovered - Hover state from parent to control video playback
 * @returns Thumbnail row or null if no items
 *
 * @example
 * <ContentIndexArtifactsItemThumbnails
 *   mediaItems={extractedMedia}
 *   slug="project-slug"
 *   maxItems={8}
 *   isHovered={isHovered}
 * />
 */
export default function ContentIndexArtifactsItemThumbnails({
	mediaItems,
	slug,
	maxItems = 4,
	isHovered,
}: ContentIndexArtifactsItemThumbnailsProps) {
	const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

	// Limit items if maxItems is set (0 means unlimited)
	const displayItems = maxItems > 0 ? mediaItems.slice(0, maxItems) : mediaItems;

	// Control video playback based on hover state
	useEffect(() => {
		for (const [, videoElement] of videoRefs.current.entries()) {
			if (isHovered) {
				videoElement.play().catch(() => {
					// Silently handle autoplay failures (browser policy)
				});
			} else {
				videoElement.pause();
			}
		}
	}, [isHovered]);

	// Cleanup video refs on unmount
	useEffect(() => {
		const currentMap = videoRefs.current;
		return () => {
			// Pause all videos and clear map
			for (const [, videoElement] of currentMap.entries()) {
				videoElement.pause();
			}
			currentMap.clear();
		};
	}, []);

	if (displayItems.length === 0) return null;

	return (
		<div
			className={`flex gap-2 transition-all duration-300 ease-out ${isHovered ? 'opacity-100' : 'opacity-90 grayscale'}`}
		>
			{displayItems.map((mediaItem, index) => {
				const uniqueKey = `${mediaItem.filename}-${index}`;
				const preset = selectPreset(slug, mediaItem.filename);
				const cdnUrl = `${CDN.mediaUrl}${mediaItem.filename}`;

				return (
					<div
						key={uniqueKey}
						className="shrink-0"
						style={{
							aspectRatio: preset.ratio,
							height: `calc(4rem * ${preset.heightScale})`,
						}}
					>
						{mediaItem.type === 'image' ? (
							<AtomicImage src={cdnUrl} alt={mediaItem.filename} />
						) : (
							<AtomicVideo
								videoRef={(el) => {
									if (el) {
										videoRefs.current.set(uniqueKey, el);
									} else {
										videoRefs.current.delete(uniqueKey);
									}
								}}
								src={cdnUrl}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
