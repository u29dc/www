'use client';

/**
 * Content Feed Item
 *
 * ## SUMMARY
 * Single feed item with AnimatedLink for timeline-aware navigation.
 *
 * ## RESPONSIBILITIES
 * - Render title, description, and type-specific metadata with AnimatedLink wrapper
 *
 * @module components/content/content-feed-item
 */

import { AnimatedLink } from '@/components/animation/animated-link';
import { isStudy, type ParsedContent } from '@/lib/mdx-types';

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export interface ContentIndexFeedItemProps {
	item: ParsedContent;
}

export function ContentIndexFeedItem({ item }: ContentIndexFeedItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;

	return (
		<AnimatedLink href={`/${slug}`}>
			<div className="my-2 md:my-5 grid grid-cols-10">
				<h2 className="padding-standard py-0 row-start-1 content-column">
					{title.toUpperCase()}
				</h2>
				<p className="padding-standard py-0 row-start-2 content-column">{description}</p>
				<p className="row-start-3 col-start-1 col-span-2 md:row-start-1 md:col-start-1 lg:col-start-4 xl:col-start-5 2xl:col-start-6 padding-standard py-0">
					{isStudy(frontmatter) ? frontmatter.year : formatDate(date)}
				</p>
			</div>
		</AnimatedLink>
	);
}
