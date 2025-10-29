/**
 * Content Artifacts
 *
 * ## SUMMARY
 * Server component rendering artifacts items with AnimatedContentArtifacts for staggered animations.
 *
 * ## RESPONSIBILITIES
 * - Fetch artifacts content and render items in AnimatedContentArtifacts wrapper
 *
 * @module components/content/content-artifacts
 */

import { AnimatedContentArtifacts } from '@/components/animation/animated-content-artifacts';
import { ContentIndexArtifactsItem } from '@/components/content/content-index-artifacts_item';
import { getFeedContent } from '@/lib/mdx-server';

export async function ContentIndexArtifacts() {
	const content = await getFeedContent();
	const thumbnails = content.map((item) => item.frontmatter.thumbnailMedia ?? null);

	return (
		<AnimatedContentArtifacts
			stageId="index-artifacts"
			className="col-span-full"
			thumbnails={thumbnails}
		>
			{content.map((item) => (
				<ContentIndexArtifactsItem key={item.frontmatter.slug} item={item} />
			))}
		</AnimatedContentArtifacts>
	);
}
