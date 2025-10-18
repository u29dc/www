/**
 * Feature MDX Media Item Component
 *
 * ## SUMMARY
 * Individual media item that loads natural dimensions, calculates aspect ratio,
 * and applies proportional flex-basis from parent context for optimal layout.
 *
 * ## RESPONSIBILITIES
 * - Detect media type (image vs video) from filename extension
 * - Load natural dimensions after media load event
 * - Calculate aspect ratio: width ÷ height
 * - Register aspect ratio with parent via MediaLayoutContext
 * - Apply flex-basis styling for proportional width distribution
 * - Maintain aspect ratio without distortion using object-fit
 *
 * ## KEY FLOWS
 * 1. Component mounts and media begins loading from BunnyCDN
 * 2. Check if media already loaded (cached) or wait for load event
 * 3. Extract natural dimensions and calculate aspect ratio (width ÷ height)
 * 4. Register aspect ratio with parent via MediaLayoutContext
 * 5. Receive proportional flex-basis from parent and apply to container
 *
 * @module components/feature-mdx-media-item
 */

'use client';

import type { SyntheticEvent } from 'react';
import { useContext, useEffect, useId, useRef } from 'react';
import { MediaLayoutContext } from '@/components/feature-mdx-media';
import { CDN } from '@/lib/meta/config';
import type { FeatureMdxMediaItemProps } from '@/lib/types/components';

const VIDEO_EXTENSIONS = ['.webm'];

function isVideo(filename: string): boolean {
	const lowercase = filename.toLowerCase();
	return VIDEO_EXTENSIONS.some((ext) => lowercase.includes(ext));
}

/**
 * Extract aspect ratio from already-loaded media element
 * Returns 0 if media is not yet loaded or dimensions are invalid
 */
function getLoadedAspectRatio(
	element: HTMLImageElement | HTMLVideoElement,
	isVideoFile: boolean,
): number {
	if (isVideoFile) {
		const video = element as HTMLVideoElement;
		// Check if video metadata is already loaded (readyState >= HAVE_METADATA)
		if (video.readyState >= 1 && video.videoWidth > 0) {
			return video.videoWidth / video.videoHeight;
		}
	} else {
		const img = element as HTMLImageElement;
		// Check if image is already loaded (cached)
		if (img.complete && img.naturalWidth > 0) {
			return img.naturalWidth / img.naturalHeight;
		}
	}
	return 0;
}

export function FeatureMdxMediaItem({ src, alt }: FeatureMdxMediaItemProps) {
	const id = useId();
	const context = useContext(MediaLayoutContext);
	const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
	const fullUrl = `${CDN.mediaUrl}${src}`;
	const isVideoFile = isVideo(src);

	// Handle image load: extract natural dimensions and calculate aspect ratio
	const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
		const img = event.currentTarget;
		const aspectRatio = img.naturalWidth / img.naturalHeight;

		if (context && Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
	};

	// Handle video metadata load: extract video dimensions and calculate aspect ratio
	const handleVideoMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
		const video = event.currentTarget;
		const aspectRatio = video.videoWidth / video.videoHeight;

		if (context && Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
	};

	// Handle already-loaded media (cached images/videos)
	// For cached media, load events fire before React attaches handlers
	// biome-ignore lint/correctness/useExhaustiveDependencies: context omitted to prevent infinite loops - only need to register once on mount
	useEffect(() => {
		const element = mediaRef.current;
		if (!element || !context) return;

		const aspectRatio = getLoadedAspectRatio(element, isVideoFile);

		if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
		// Note: context is intentionally omitted from dependencies to prevent infinite loops
		// We only need to register the aspect ratio once when the media loads
		// The context reference changes when aspectRatios updates, which would trigger re-registration
	}, [id, isVideoFile]);

	// Get flex-basis from parent context (proportional to aspect ratio)
	const flexBasis = context?.getFlexBasis(id) ?? '1';

	return (
		<div style={{ flexBasis, flexShrink: 0 }} className="h-full">
			{isVideoFile ? (
				<video
					ref={mediaRef as React.RefObject<HTMLVideoElement>}
					src={fullUrl}
					muted
					loop
					playsInline
					autoPlay
					onLoadedMetadata={handleVideoMetadata}
					className="media-fill"
				/>
			) : (
				// biome-ignore lint/performance/noImgElement: MDX content requires direct HTML img control
				<img
					ref={mediaRef as React.RefObject<HTMLImageElement>}
					src={fullUrl}
					alt={alt || ''}
					loading="lazy"
					onLoad={handleImageLoad}
					className="media-fill"
				/>
			)}
		</div>
	);
}
