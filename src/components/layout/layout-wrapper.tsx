/**
 * Layout Wrapper
 *
 * ## SUMMARY
 * Main grid layout with header, footer, gradient blur, and content sections.
 *
 * ## RESPONSIBILITIES
 * - Provide consistent grid structure for index and article pages
 *
 * @module components/layout/layout-wrapper
 */

import type { ReactNode } from 'react';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { LayoutFooter } from '@/components/layout/layout-footer';
import { LayoutHeader } from '@/components/layout/layout-header';
import type { ContentItem } from '@/lib/mdx-types';

export interface LayoutWrapperProps {
	type: 'index' | 'article';
	children: ReactNode;
	frontmatter?: ContentItem;
}

export function LayoutWrapper({ type, children, frontmatter }: LayoutWrapperProps) {
	return (
		<main className="grid grid-cols-10 grid-rows-[15rem_min-content_auto_10rem] full-container min-h-screen">
			<section className="content-column row-start-1 sticky top-0 z-[1000]">
				<AtomicGradientBlur position="top" size="15rem" fixed={false} layers={10} />
			</section>
			<section className="content-column row-start-1 sticky top-0 z-[1001]">
				<LayoutHeader type={type} frontmatter={frontmatter} />
			</section>

			<section className="col-span-full grid grid-cols-10">{children}</section>

			<section className="col-span-full"></section>

			<section className="content-column -row-start-2 relative z-[1001]">
				<LayoutFooter />
			</section>
		</main>
	);
}
