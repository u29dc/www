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
		<main className="full-container min-h-screen">
			<section data-section="header" className="w-full sticky top-0 z-1001">
				<LayoutSharedHeader type={type} frontmatter={frontmatter} />
			</section>
			<section data-section="content" className="w-full">
				{children}
			</section>
			<section data-section="footer" className="w-full sticky">
				<LayoutSharedFooter />
			</section>
		</main>
	);
}
