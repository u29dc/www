/**
 * Layout Shared Wrapper
 *
 * ## SUMMARY
 * Main grid layout with header, footer, gradient blur, and content sections.
 *
 * ## RESPONSIBILITIES
 * - Provide consistent grid structure for index and article pages
 *
 * @module components/layout/layout-shared-wrapper
 */

import type { ReactNode } from 'react';
import { CoreScrollOverlay } from '@/components/core/core-scroll-overlay';
import { LayoutSharedFooter } from '@/components/layout/layout-shared-footer';
import { LayoutSharedHeader } from '@/components/layout/layout-shared-header';
import type { ContentItem } from '@/lib/mdx-types';

export interface LayoutSharedWrapperProps {
	type: 'index' | 'article';
	children: ReactNode;
	frontmatter?: ContentItem;
}

export function LayoutSharedWrapper({ type, children, frontmatter }: LayoutSharedWrapperProps) {
	return (
		<main className="full-container relative isolate min-h-screen overflow-x-hidden">
			<section data-section="header" className="relative z-10 w-full">
				<LayoutSharedHeader type={type} frontmatter={frontmatter} />
			</section>

			{type === 'index' && <CoreScrollOverlay />}

			<section data-section="content" className="relative w-full">
				{children}
			</section>

			<section data-section="footer" className="relative z-40 w-full">
				<LayoutSharedFooter />
			</section>
		</main>
	);
}
