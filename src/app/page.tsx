/**
 * Home Page
 *
 * ## SUMMARY
 * Displays intro content and chronological feed of all content items.
 *
 * ## RESPONSIBILITIES
 * - Render site header with intro animation
 * - Render content feed component
 * - Compose layout wrapper
 * - Provide timeline coordination via page-level wrapper
 *
 * ## USAGE
 * ```tsx
 * // Automatic Next.js route at /
 * ```
 *
 * @module app/page
 */

import { TimelinePageWrapper } from '@/components/base-timeline-page-wrapper';
import { ComposedLayoutWrapper } from '@/components/composed-layout-wrapper';
import { FeatureContentFeed } from '@/components/feature-content-feed';
import { FeatureContentHome } from '@/components/feature-content-home';
import { homeTimeline } from '@/lib/animation/configs';

export default function HomePage() {
	return (
		<TimelinePageWrapper config={homeTimeline}>
			<ComposedLayoutWrapper type="page-home">
				<FeatureContentHome />
				<FeatureContentFeed />
			</ComposedLayoutWrapper>
		</TimelinePageWrapper>
	);
}
