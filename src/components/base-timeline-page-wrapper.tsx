'use client';

/**
 * Timeline Page Wrapper
 *
 * ## SUMMARY
 * Thin client wrapper providing timeline context at page level.
 * Uses server-client-server sandwich pattern to preserve server components.
 *
 * ## RESPONSIBILITIES
 * - Wrap page content with TimelineProvider
 * - Enable timeline-aware animations throughout page hierarchy
 * - Maintain server component boundaries via children prop
 *
 * ## USAGE
 * ```tsx
 * // In page.tsx (server component)
 * <TimelinePageWrapper config={homeTimeline}>
 *   <ComposedLayoutWrapper>
 *     <ServerComponent />
 *   </ComposedLayoutWrapper>
 * </TimelinePageWrapper>
 * ```
 *
 * @module components/base-timeline-page-wrapper
 */

import type { ReactNode } from 'react';
import type { TimelineConfig } from '@/lib/animation/timeline';
import { TimelineProvider } from '@/lib/animation/timeline';

export interface TimelinePageWrapperProps {
	config: TimelineConfig;
	children: ReactNode;
}

/**
 * TimelinePageWrapper component
 *
 * Provides timeline context at page level while preserving server components.
 * Children are passed through via React composition pattern.
 */
export function TimelinePageWrapper({ config, children }: TimelinePageWrapperProps) {
	return (
		<TimelineProvider config={config} autoPlay>
			{children}
		</TimelineProvider>
	);
}
