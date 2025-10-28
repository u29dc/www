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
import { LayoutContentBlock } from '@/components/layout/layout-content-block';
import { LayoutSharedWrapper } from '@/components/layout/layout-shared-wrapper';
import { TIMELINE_INDEX } from '@/lib/constants';

export default function HomePage() {
	return (
		<CoreTimelineProvider config={TIMELINE_INDEX}>
			<LayoutSharedWrapper type="index">
				<LayoutContentBlock id={0} title="about">
					<ContentIndexAbout />
				</LayoutContentBlock>
				<LayoutContentBlock id={1} title="feed">
					<ContentIndexFeed />
				</LayoutContentBlock>
			</LayoutSharedWrapper>
		</CoreTimelineProvider>
	);
}
