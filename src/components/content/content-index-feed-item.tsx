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

import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { AnimatedLink } from '@/components/animation/animated-link';
import type {
	ContentItem,
	FragmentContent,
	ParsedContent,
	SignalContent,
	StudyContent,
} from '@/lib/mdx';

interface MetadataItem {
	label: string;
	value: ReactNode;
}

function isStudy(item: ContentItem): item is StudyContent {
	return item.type === 'study';
}

function isFragment(item: ContentItem): item is FragmentContent {
	return item.type === 'fragment';
}

function isSignal(item: ContentItem): item is SignalContent {
	return item.type === 'signal';
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStudyMetadata(study: StudyContent): MetadataItem[] {
	return [
		{ label: 'Client', value: study.client },
		{ label: 'Role', value: study.role },
		{ label: 'Year', value: study.year.toString() },
		{ label: 'Mode', value: study.mode },
	];
}

function getFragmentMetadata(_fragment: FragmentContent, formattedDate: string): MetadataItem[] {
	return [{ label: 'Date', value: formattedDate }];
}

function getSignalMetadata(signal: SignalContent, formattedDate: string): MetadataItem[] {
	const items: MetadataItem[] = [{ label: 'Date', value: formattedDate }];
	if (signal.source) {
		items.push({ label: 'Source', value: signal.source });
	}
	return items;
}

export interface ContentIndexFeedItemProps {
	item: ParsedContent;
}

export function ContentIndexFeedItem({ item }: ContentIndexFeedItemProps) {
	const { frontmatter } = item;
	const { title, slug, description, date } = frontmatter;
	const formattedDate = formatDate(date);

	let metadataItems: MetadataItem[] = [];
	if (isStudy(frontmatter)) {
		metadataItems = getStudyMetadata(frontmatter);
	} else if (isFragment(frontmatter)) {
		metadataItems = getFragmentMetadata(frontmatter, formattedDate);
	} else if (isSignal(frontmatter)) {
		metadataItems = getSignalMetadata(frontmatter, formattedDate);
	}

	return (
		<div className="col-span-full">
			<AnimatedLink href={`/${slug}`} className="group">
				<h2>{title}</h2>
				<p>{description}</p>
				{metadataItems.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						{metadataItems.map((item, index) => (
							<Fragment key={item.label}>
								<span>{item.value}</span>
								{index < metadataItems.length - 1 && <span>|</span>}
							</Fragment>
						))}
					</div>
				)}
			</AnimatedLink>
		</div>
	);
}
