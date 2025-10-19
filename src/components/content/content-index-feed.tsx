/**
 * Content Feed
 *
 * ## SUMMARY
 * Server component rendering feed items with AnimatedFeedWrapper for staggered animations.
 *
 * ## RESPONSIBILITIES
 * - Fetch feed content and render items in AnimatedFeedWrapper
 *
 * @module components/content/content-feed
 */

import { AnimatedFeedWrapper } from '@/components/animation/animated-feed-wrapper';
import { ContentIndexFeedItem } from '@/components/content/content-index-feed-item';
import { getFeedContent } from '@/lib/mdx-server';

export async function ContentIndexFeed() {
	const content = await getFeedContent();
	const thumbnails = content.map((item) => item.frontmatter.thumbnailMedia ?? null);

	return (
		<AnimatedFeedWrapper stageId="index-feed" className="col-span-full" thumbnails={thumbnails}>
			{content.map((item) => (
				<ContentIndexFeedItem key={item.frontmatter.slug} item={item} />
			))}
		</AnimatedFeedWrapper>
	);
}
