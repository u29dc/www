/**
 * Home Page
 *
 * ## SUMMARY
 * Displays intro content and animated chronological feed of all content items.
 *
 * ## RESPONSIBILITIES
 * - Compose layout wrapper with timeline-coordinated animations
 *
 * @module app/page
 */

import { ContentIndexAbout } from '@/components/content/content-index-about';
import { ContentIndexFeed } from '@/components/content/content-index-feed';
import { CoreTimelineProvider } from '@/components/core/core-timeline-provider';
import { LayoutWrapper } from '@/components/layout/layout-wrapper';
import { indexTimeline } from '@/lib/constants';

export default function HomePage() {
	return (
		<CoreTimelineProvider config={indexTimeline}>
			<LayoutWrapper type="index">
				<ContentIndexAbout />
				<ContentIndexFeed />
			</LayoutWrapper>
		</CoreTimelineProvider>
	);
}
