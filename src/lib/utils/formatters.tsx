/**
 * Content Formatting Utilities
 *
 * ## SUMMARY
 * Centralized formatting functions for dates, content descriptions, and metadata builders.
 *
 * ## RESPONSIBILITIES
 * - Format ISO dates to readable strings
 * - Extract type-specific descriptions from content items
 * - Build metadata items for different content types
 *
 * ## USAGE
 * ```tsx
 * import { formatDate, getContentDescription, getStudyMetadata } from '@/lib/utils/formatters';
 *
 * const date = formatDate(item.date);
 * const description = getContentDescription(item);
 * const metadata = getStudyMetadata(study, date);
 * ```
 *
 * @module lib/utils/formatters
 */

import type { ReactNode } from 'react';
import type {
	ContentItem,
	FragmentContent,
	SignalContent,
	StudyContent,
} from '@/lib/types/content';
import { isFragment } from '@/lib/types/content';

/**
 * Metadata item for display
 */
export interface MetadataItem {
	label: string;
	value: ReactNode;
}

/**
 * Format ISO date string to human-readable format
 */
export function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString('en-US', {
		year: 'numeric',
	});
}

/**
 * Extract description text from content item based on type
 */
export function getContentDescription(item: ContentItem): string {
	if (isFragment(item) && item.excerpt) return item.excerpt;
	return item.description;
}

/**
 * Build metadata items for Study content
 */
export function getStudyMetadata(study: StudyContent): MetadataItem[] {
	return [
		{ label: 'Client', value: study.client },
		{ label: 'Role', value: study.role },
		{ label: 'Year', value: String(study.year) },
	];
}

/**
 * Build metadata items for Fragment content
 */
export function getFragmentMetadata(
	fragment: FragmentContent,
	formattedDate: string,
): MetadataItem[] {
	return [
		{ label: 'Type', value: fragment.type },
		{ label: 'Date', value: formattedDate },
	];
}

/**
 * Build metadata items for Signal content
 */
export function getSignalMetadata(signal: SignalContent, formattedDate: string): MetadataItem[] {
	const items: MetadataItem[] = [];
	if (signal.source) {
		items.push({ label: 'Source', value: signal.source });
	}
	items.push({ label: 'Date', value: formattedDate });
	if (signal.link) {
		items.push({
			label: 'Link',
			value: (
				<a href={signal.link} target="_blank" rel="noopener noreferrer">
					View Source
				</a>
			),
		});
	}
	return items;
}
