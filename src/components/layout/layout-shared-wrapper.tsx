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
		<main className="grid grid-cols-10 grid-rows-[15rem_min-content_auto_10rem] full-container min-h-screen">
			<section className="content-column row-start-1 sticky top-0 z-1001">
				<LayoutSharedHeader type={type} frontmatter={frontmatter} />
			</section>

			<section className="grid grid-cols-10 col-span-full">{children}</section>

			<section className="content-column -row-start-2 relative z-1001">
				<LayoutSharedFooter />
			</section>
		</main>
	);
}
