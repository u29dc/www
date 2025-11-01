/**
 * Home Page
 *
 * ## SUMMARY
 * Displays intro statement and animated artifacts of all content items.
 *
 * ## RESPONSIBILITIES
 * - Compose layout wrapper with timeline-coordinated animations
 *
 * @module app/page
 */

import { ContentIndexArtifacts } from '@/components/content/content-index-artifacts';
import { ContentIndexAxioms } from '@/components/content/content-index-axioms';
// import { ContentIndexProtocols } from '@/components/content/content-index-protocols';
import { ContentIndexStatement } from '@/components/content/content-index-statement';
import { CoreTimelineProvider } from '@/components/core/core-timeline-provider';
import { LayoutContentBlock } from '@/components/layout/layout-content-block';
import { LayoutSharedWrapper } from '@/components/layout/layout-shared-wrapper';
import { TIMELINE_INDEX } from '@/lib/constants';

export default function HomePage() {
	return (
		<CoreTimelineProvider config={TIMELINE_INDEX}>
			<LayoutSharedWrapper type="index">
				<LayoutContentBlock id={0} title="statement" colSpanFull={false} className="">
					<ContentIndexStatement />
				</LayoutContentBlock>
				<LayoutContentBlock id={1} title="artifacts" colSpanFull={true} className="">
					<ContentIndexArtifacts />
				</LayoutContentBlock>
				<LayoutContentBlock id={2} title="axioms" colSpanFull={false} className="">
					<ContentIndexAxioms />
				</LayoutContentBlock>
				{/*
				<LayoutContentBlock id={3} title="protocols" colSpanFull={false} className="">
					<ContentIndexProtocols />
				</LayoutContentBlock>
				*/}
			</LayoutSharedWrapper>
		</CoreTimelineProvider>
	);
}
