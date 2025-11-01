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

import { ContentIndexArtifactsItem } from '@/components/content/content-index-artifacts-item';
import { ContentIndexArtifactsList } from '@/components/content/content-index-artifacts-list';
import { getArtifactsContent } from '@/lib/mdx-server';
import { isStudy } from '@/lib/mdx-types';

export async function ContentIndexArtifacts() {
	const content = await getArtifactsContent();

	return (
		<ContentIndexArtifactsList stageId="index-artifacts" className="">
			{content.map((item) => {
				const isConfidential =
					isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false);
				return (
					<ContentIndexArtifactsItem
						key={item.frontmatter.slug}
						item={item}
						isConfidential={isConfidential}
						thumbnailUrl={item.frontmatter.thumbnailMedia ?? null}
					/>
				);
			})}
		</ContentIndexArtifactsList>
	);
}
