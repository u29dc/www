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
import { AnimatedLink } from '@/components/animation/animated-link';
import { getFeedContent } from '@/lib/mdx-server';
import { isStudy, type ParsedContent } from '@/lib/mdx-types';

export interface ContentIndexArtifactsItemProps {
	item: ParsedContent;
	isConfidential: boolean;
}

export function ContentIndexArtifactsItem({
	item,
	isConfidential,
}: ContentIndexArtifactsItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;

	const contentBlock = (
		<div className="my-2 md:my-5 grid grid-cols-10">
			<p className="padding-standard py-0 col-span-base row-start-2">{title.toUpperCase()}</p>
			<p className="padding-standard py-0 col-span-full row-start-3 md:col-start-3 md:col-span-8 lg:col-start-4 lg:col-span-7 xl:col-start-2 xl:col-span-3 xl:row-start-2 xl:row-span-2 2xl:col-start-2 2xl:col-span-4">
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

export async function ContentIndexArtifacts() {
	const content = await getFeedContent();
	const thumbnails = content.map((item) => item.frontmatter.thumbnailMedia ?? null);

	return (
		<AnimatedContentArtifacts stageId="index-artifacts" className="" thumbnails={thumbnails}>
			{content.map((item) => {
				const isConfidential =
					isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false);
				return (
					<ContentIndexArtifactsItem
						key={item.frontmatter.slug}
						item={item}
						isConfidential={isConfidential}
					/>
				);
			})}
		</AnimatedContentArtifacts>
	);
}
