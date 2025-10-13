/**
 * Metadata List Component
 *
 * ## SUMMARY
 * Renders content metadata as inline list with pipe separators.
 * Handles date formatting and type-specific metadata building internally.
 *
 * ## RESPONSIBILITIES
 * - Format date from frontmatter
 * - Determine content type and build appropriate metadata
 * - Display metadata items with consistent formatting
 * - Handle empty/null values gracefully
 *
 * ## USAGE
 * ```tsx
 * <MetadataList frontmatter={frontmatter} />
 * ```
 *
 * @module components/ui/metadata-list
 */

import { Fragment } from 'react';
import type { MetadataListProps } from '@/lib/types/components';
import { isFragment, isSignal, isStudy } from '@/lib/types/content';
import type { MetadataItem } from '@/lib/types/utils';
import {
	formatDate,
	getFragmentMetadata,
	getSignalMetadata,
	getStudyMetadata,
} from '@/lib/utils/formatters';

export function MetadataList({ frontmatter, className = '' }: MetadataListProps) {
	// Format date and build metadata items based on content type
	const formattedDate = formatDate(frontmatter.date);
	let items: MetadataItem[] = [];

	if (isStudy(frontmatter)) {
		items = getStudyMetadata(frontmatter);
	} else if (isFragment(frontmatter)) {
		items = getFragmentMetadata(frontmatter, formattedDate);
	} else if (isSignal(frontmatter)) {
		items = getSignalMetadata(frontmatter, formattedDate);
	}

	if (items.length === 0) return null;

	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			{items.map((item, index) => (
				<Fragment key={item.label}>
					<span>{item.value}</span>
					{index < items.length - 1 && <span>|</span>}
				</Fragment>
			))}
		</div>
	);
}
