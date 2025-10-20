'use client';

/**
 * Animated Feed Thumbnail
 *
 * ## SUMMARY
 * Motion-animated thumbnail preview for feed items with layoutId sliding transitions.
 *
 * ## RESPONSIBILITIES
 * - Render image or video thumbnails with CDN URLs
 * - Apply Motion layoutId for smooth sliding between items
 * - Handle media type detection and validation
 *
 * @module components/animation/animated-feed-thumbnail
 */

import { motion } from 'motion/react';
import { CDN } from '@/lib/constants';
import { getMediaType, sanitizeMediaFilename } from '@/lib/mdx-client';

export interface AnimatedFeedThumbnailProps {
	thumbnailUrl: string | null;
}

export function AnimatedFeedThumbnail({ thumbnailUrl }: AnimatedFeedThumbnailProps) {
	if (!thumbnailUrl) return null;

	const sanitized = sanitizeMediaFilename(thumbnailUrl);
	if (!sanitized) return null;

	const mediaType = getMediaType(sanitized);
	if (!mediaType) return null;

	const cdnUrl = `${CDN.mediaUrl}${sanitized}`;

	return (
		<motion.div
			layoutId="feed-thumbnail-preview"
			className="pointer-events-none absolute left-40 top-1/2 translate-y-[-50%] h-[10rem] w-[20rem] overflow-hidden"
			transition={{
				layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
			}}
		>
			{mediaType === 'image' ? (
				// biome-ignore lint/performance/noImgElement: CDN-optimized thumbnails, Image component unnecessary overhead
				<img src={cdnUrl} alt="" className="w-full h-full object-cover" loading="eager" />
			) : (
				<video
					src={cdnUrl}
					autoPlay
					muted
					loop
					playsInline
					className="w-full h-full object-cover"
				/>
			)}
		</motion.div>
	);
}
