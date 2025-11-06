'use client';

/**
 * Content Artifacts Item
 *
 * ## SUMMARY
 * Client component rendering individual artifact item with hover-triggered video playback.
 *
 * ## RESPONSIBILITIES
 * - Render artifact item with title, description, date
 * - Manage hover state for video playback in thumbnail row
 * - Handle confidential state display
 *
 * @module components/content/content-artifacts-item
 */

import { useState } from 'react';
import { AnimatedLink } from '@/components/animation/animated-link';
import ContentIndexArtifactsItemThumbnails from '@/components/content/content-index-artifacts-item-thumbnails';
import type { MediaItem } from '@/lib/mdx-client';
import { isStudy, type ParsedContent } from '@/lib/mdx-types';

export interface ContentIndexArtifactsItemProps {
	item: ParsedContent;
	isConfidential: boolean;
	thumbnailUrl: string | null;
	hoveredIndex?: number | null;
	itemIndex?: number;
	mediaItems: MediaItem[];
}

export function ContentIndexArtifactsItem({
	item,
	isConfidential,
	thumbnailUrl: _thumbnailUrl,
	hoveredIndex,
	itemIndex,
	mediaItems,
}: ContentIndexArtifactsItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;
	const [isHovered, setIsHovered] = useState(false);

	const contentBlock = (
		// biome-ignore lint/a11y/noStaticElementInteractions: Hover state used for video playback control in child components, not primary interaction
		<div
			className={`relative grid grid-cols-10 border-current/10 border-t py-5 pt-2 underline decoration-wavy transition-colors duration-250 ${hoveredIndex === itemIndex && !isConfidential ? 'decoration-current' : 'decoration-transparent'} ${isConfidential ? 'cursor-not-allowed' : ''}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<p className={`col-span-base row-start-1`}>{title.toUpperCase()}</p>
			<p className="col-span-full row-start-2 normal-case md:col-span-8 md:col-start-3 lg:col-span-7 lg:col-start-4 lg:row-start-2 xl:col-span-3 xl:col-start-5 xl:row-span-2 xl:row-start-2 2xl:col-span-4 2xl:col-start-2">
				{isConfidential ? 'Confidential' : description}
			</p>
			<p className="col-span-1 col-start-1 row-start-3 md:col-span-1 md:col-start-1 md:row-start-2">
				{isStudy(frontmatter)
					? new Date(date).getFullYear()
					: new Date(date).toISOString().slice(0, 10).replace(/-/g, '/')}
			</p>
			<p className="-col-start-1 col-span-4 row-start-2 flex h-full flex-col justify-center text-right font-mono md:col-span-1 md:col-start-1 md:row-start-1 md:pr-5 md:text-left">
				<span>{String(new Date(date).toISOString())}</span>
			</p>

			{/* Thumbnail row */}
			<div className="col-span-base row-start--4 my-4">
				<ContentIndexArtifactsItemThumbnails
					mediaItems={mediaItems}
					slug={slug}
					maxItems={8}
					isHovered={isHovered}
				/>
			</div>
		</div>
	);

	if (isConfidential) {
		return <div>{contentBlock}</div>;
	}

	return <AnimatedLink href={`/${slug}`}>{contentBlock}</AnimatedLink>;
}
