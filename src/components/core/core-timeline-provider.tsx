'use client';

/**
 * Core Timeline Provider
 *
 * ## SUMMARY
 * Client wrapper providing timeline context at page level while preserving server components.
 *
 * ## RESPONSIBILITIES
 * - Wrap page content with TimelineProvider for timeline-aware animations
 *
 * @module components/core/core-timeline-provider
 */

import type { ReactNode } from 'react';
import type { TimelineConfig } from '@/lib/timeline';
import { TimelineProvider } from '@/lib/timeline';

export interface CoreTimelineProviderProps {
	config: TimelineConfig;
	children: ReactNode;
}

export function CoreTimelineProvider({ config, children }: CoreTimelineProviderProps) {
	return (
		<TimelineProvider config={config} autoPlay>
			{children}
		</TimelineProvider>
	);
}
