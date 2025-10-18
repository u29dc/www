/**
 * Feature Content Feed Component
 *
 * ## SUMMARY
 * Renders feed list of all content items with title, date, and description.
 *
 * ## RESPONSIBILITIES
 * - Fetch all feed content via aggregator
 * - Map over content items and render each
 * - Delegate single item rendering to internal FeedItem component
 *
 * ## USAGE
 * ```tsx
 * <FeatureContentFeed />
 * ```
 *
 * @module components/feature-content-feed
 */

import Link from 'next/link';
import { Fragment } from 'react';
import { getFeedContent } from '@/lib/mdx/aggregator';
import type { FeedItemProps } from '@/lib/types/components';
import { isFragment, isSignal, isStudy } from '@/lib/types/content';
import type { MetadataItem } from '@/lib/types/utils';
import {
	formatDate,
	getFragmentMetadata,
	getSignalMetadata,
	getStudyMetadata,
} from '@/lib/utils/formatters';

/**
 * Internal feed item component
 * Renders single content item with title, date, and description
 */
function FeedItem({ item }: FeedItemProps) {
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
			<Link href={`/${slug}`} className="group" aria-label={`${title}`}>
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
			</Link>
		</div>
	);
}

export async function FeatureContentFeed() {
	const content = await getFeedContent();

	return (
		<div className="content-column padding-standard">
			<div className="flex flex-col space-y-5">
				{content.map((item) => (
					<FeedItem key={item.frontmatter.slug} item={item} />
				))}
			</div>
		</div>
	);
}
