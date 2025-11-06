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

import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';
import { ContentIndexArtifactsItem } from '@/components/content/content-index-artifacts-item';
import { ContentIndexArtifactsList } from '@/components/content/content-index-artifacts-list';
import { extractMediaFromContent } from '@/lib/mdx-client';
import { getArtifactsContent } from '@/lib/mdx-server';
import { isStudy } from '@/lib/mdx-types';

export async function ContentIndexArtifacts() {
	const content = await getArtifactsContent();

	return (
		<div className="my-10">
			<AnimatedStaggerRedacted stageId="meta-annotation" className="flex w-full justify-end">
				<div className="mb-10 text-right font-mono">
					the territory between disciplines holds questions specialists cannot ask alone
				</div>
			</AnimatedStaggerRedacted>

			<ContentIndexArtifactsList stageId="index-artifacts" className="">
				{content.map((item) => {
					const isConfidential =
						isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false);
					const mediaItems = extractMediaFromContent(item.content);
					return (
						<ContentIndexArtifactsItem
							key={item.frontmatter.slug}
							item={item}
							isConfidential={isConfidential}
							thumbnailUrl={item.frontmatter.thumbnailMedia ?? null}
							mediaItems={mediaItems}
						/>
					);
				})}
			</ContentIndexArtifactsList>
		</div>
	);
}
