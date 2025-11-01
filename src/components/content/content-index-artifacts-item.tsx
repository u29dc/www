/**
 * Content Artifacts Item
 *
 * ## SUMMARY
 * Client component rendering individual artifact item with motion thumbnail animation.
 *
 * ## RESPONSIBILITIES
 * - Render artifact item with title, description, date
 * - Animate thumbnail on hover with height transition
 * - Handle confidential state display
 *
 * @module components/content/content-artifacts-item
 */

'use client';

import { motion } from 'motion/react';
import { AnimatedLink } from '@/components/animation/animated-link';
import { CDN } from '@/lib/constants';
import { getMediaType, sanitizeMediaFilename } from '@/lib/mdx-client';
import { isStudy, type ParsedContent } from '@/lib/mdx-types';

export interface ContentIndexArtifactsItemProps {
	item: ParsedContent;
	isConfidential: boolean;
	thumbnailUrl: string | null;
	hoveredIndex?: number | null;
	itemIndex?: number;
}

export function ContentIndexArtifactsItem({
	item,
	isConfidential,
	thumbnailUrl,
	hoveredIndex,
	itemIndex,
}: ContentIndexArtifactsItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;

	// Prepare thumbnail media
	const sanitized = thumbnailUrl ? sanitizeMediaFilename(thumbnailUrl) : null;
	const mediaType = sanitized ? getMediaType(sanitized) : null;
	const cdnUrl = sanitized ? `${CDN.mediaUrl}${sanitized}` : null;

	const contentBlock = (
		<div className="my-2 md:my-5 grid grid-cols-10 relative">
			{/* Thumbnail with height animation */}
			{cdnUrl && mediaType && (
				<div className="hidden hover-device:block row-start-2 col-start-5 col-span-1 relative">
					<motion.div
						initial={{ height: 0 }}
						animate={{
							height: hoveredIndex === itemIndex ? '10rem' : 0,
						}}
						transition={{
							duration: 0.25,
							ease: [0.22, 1, 0.36, 1],
						}}
						className="pointer-events-none absolute left-0 top-1/2 translate-y-[-50%] w-full overflow-hidden"
					>
						{mediaType === 'image' ? (
							// biome-ignore lint/performance/noImgElement: CDN-optimized thumbnails, Image component unnecessary overhead
							<img
								src={cdnUrl}
								alt=""
								className="w-full h-full object-cover"
								loading="eager"
							/>
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
				</div>
			)}

			<p className="col-span-base row-start-2">{title.toUpperCase()}</p>
			<p className="col-span-full row-start-3 md:col-start-3 md:col-span-8 lg:col-start-4 lg:col-span-7 xl:col-start-2 xl:col-span-3 xl:row-start-2 xl:row-span-2 2xl:col-start-2 2xl:col-span-4">
				{description}
			</p>
			<p className="col-span-full row-start-1 md:col-span-1 md:row-start-2">
				{isStudy(frontmatter)
					? new Date(date).getFullYear()
					: new Date(date).toISOString().slice(0, 10).replace(/-/g, '/')}
			</p>
		</div>
	);

	if (isConfidential) {
		return <div className="opacity-50 cursor-default">{contentBlock}</div>;
	}

	return <AnimatedLink href={`/${slug}`}>{contentBlock}</AnimatedLink>;
}
