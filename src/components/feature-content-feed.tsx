/**
 * Feature Content Feed Component
 *
 * ## SUMMARY
 * Renders feed list of all content items with title, date, and description.
 *
 * ## RESPONSIBILITIES
 * - Fetch all feed content via aggregator
 * - Map over content items and render each
 * - Delegate single item rendering to internal FeedItem client component
 * - Wrap items in AnimatedFeedWrapper for staggered entrance
 *
 * ## USAGE
 * ```tsx
 * <FeatureContentFeed />
 * ```
 *
 * @module components/feature-content-feed
 */

import { AnimatedFeedWrapper } from '@/components/base-animated-feed-wrapper';
import { InternalFeedItem } from '@/components/internal-feed-item';
import { getFeedContent } from '@/lib/mdx/aggregator';

export async function FeatureContentFeed() {
	const content = await getFeedContent();

	return (
		<div className="content-column padding-standard">
			<AnimatedFeedWrapper stageId="home-feed" className="flex flex-col space-y-5">
				{content.map((item) => (
					<InternalFeedItem key={item.frontmatter.slug} item={item} />
				))}
			</AnimatedFeedWrapper>
		</div>
	);
}
