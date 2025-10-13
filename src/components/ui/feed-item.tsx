/**
 * Feed Item Component
 *
 * ## SUMMARY
 * Renders individual content item in the feed list with title, date, and description.
 *
 * ## RESPONSIBILITIES
 * - Display content type, title, and formatted date
 * - Extract and show type-specific description
 * - Link to individual content page
 *
 * ## USAGE
 * ```tsx
 * <FeedItem item={parsedContent} />
 * ```
 *
 * @module components/ui/feed-item
 */

import Link from 'next/link';
import { MetadataList } from '@/components/ui/metadata-list';
import type { FeedItemProps } from '@/lib/types/components';
import { formatDate } from '@/lib/utils/formatters';

export type { FeedItemProps };

export function FeedItem({ item }: FeedItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;
	const formattedDate = formatDate(date);

	return (
		<Link
			href={`/${slug}`}
			className="col-span-full group grid grid-cols-10 grid-rows-auto w-full"
		>
			<div className="content-column p-5">
				<div>{title}</div>
				<div>{description}</div>
				<MetadataList frontmatter={frontmatter} />
				<time>{formattedDate}</time>
			</div>
		</Link>
	);
}
