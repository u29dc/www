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

import { AnimatedContentFeed } from '@/components/animation/animated-content-feed';
import { ContentIndexFeedItem } from '@/components/content/content-index-feed_item';
import { getFeedContent } from '@/lib/mdx-server';

export async function ContentIndexFeed() {
	const content = await getFeedContent();
	const thumbnails = content.map((item) => item.frontmatter.thumbnailMedia ?? null);

	return (
		<AnimatedContentFeed stageId="index-feed" className="col-span-full" thumbnails={thumbnails}>
			{content.map((item) => (
				<ContentIndexFeedItem key={item.frontmatter.slug} item={item} />
			))}
		</AnimatedContentFeed>
	);
}
