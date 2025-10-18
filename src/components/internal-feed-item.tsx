'use client';

/**
 * Internal Feed Item Component
 *
 * ## SUMMARY
 * Single feed item with timeline-aware navigation link.
 *
 * ## RESPONSIBILITIES
 * - Render feed item title, description, and metadata
 * - Use AnimatedLink for exit animation coordination
 *
 * ## USAGE
 * ```tsx
 * <InternalFeedItem item={parsedContent} />
 * ```
 *
 * @module components/internal-feed-item
 */

import { Fragment } from 'react';
import { AnimatedLink } from '@/components/base-animated-link';
import type { ParsedContent } from '@/lib/mdx/types';
import { isFragment, isSignal, isStudy } from '@/lib/mdx/types';
import {
	formatDate,
	getFragmentMetadata,
	getSignalMetadata,
	getStudyMetadata,
	type MetadataItem,
} from '@/lib/utils/formatters';

/** Internal feed item component props */
export interface FeedItemProps {
	item: ParsedContent;
}

/**
 * InternalFeedItem component
 *
 * Renders single content item with title, date, and description.
 * Uses AnimatedLink for timeline-coordinated exit animations.
 */
export function InternalFeedItem({ item }: FeedItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;
	const formattedDate = formatDate(date);

	// Build metadata items based on content type
	let metadataItems: MetadataItem[] = [];
	if (isStudy(frontmatter)) {
		metadataItems = getStudyMetadata(frontmatter);
	} else if (isFragment(frontmatter)) {
		metadataItems = getFragmentMetadata(frontmatter, formattedDate);
	} else if (isSignal(frontmatter)) {
		metadataItems = getSignalMetadata(frontmatter, formattedDate);
	}

	return (
		<div className="col-span-full">
			<AnimatedLink href={`/${slug}`} className="group">
				<h2>{title}</h2>
				<p>{description}</p>
				{metadataItems.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						{metadataItems.map((item, index) => (
							<Fragment key={item.label}>
								<span>{item.value}</span>
								{index < metadataItems.length - 1 && <span>|</span>}
							</Fragment>
						))}
					</div>
				)}
			</AnimatedLink>
		</div>
	);
}
