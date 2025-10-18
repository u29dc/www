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
 *
 * ## USAGE
 * ```tsx
 * // Automatic Next.js route at /
 * ```
 *
 * @module app/page
 */

import { ComposedLayoutWrapper } from '@/components/composed-layout-wrapper';
import { FeatureContentFeed } from '@/components/feature-content-feed';
import { FeatureContentHome } from '@/components/feature-content-home';

export default function HomePage() {
	return (
		<ComposedLayoutWrapper type="page-home">
			<FeatureContentHome />
			<FeatureContentFeed />
		</ComposedLayoutWrapper>
	);
}
