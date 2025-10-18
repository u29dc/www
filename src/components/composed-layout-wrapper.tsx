/**
 * Composed Layout Wrapper Component
 *
 * ## SUMMARY
 * Basic wrapper for main content sections.
 *
 * ## USAGE
 * ```tsx
 * <ComposedLayoutWrapper>
 *   <FeatureContentFeed />
 * </ComposedLayoutWrapper>
 * ```
 *
 * @module components/composed-layout-wrapper
 */

import type { ReactNode } from 'react';
import { BaseGradientBlur } from '@/components/base-gradient-blur';
import { ComposedLayoutFooter } from '@/components/composed-layout-footer';
import { ComposedLayoutHeader } from '@/components/composed-layout-header';
import type { ContentItem } from '@/lib/mdx/types';

/** Composed layout wrapper component props */
export interface ComposedLayoutWrapperProps {
	type: 'page-home' | 'page-content';
	children: ReactNode;
	frontmatter?: ContentItem;
}

export function ComposedLayoutWrapper({ type, children, frontmatter }: ComposedLayoutWrapperProps) {
	return (
		<main className="grid grid-cols-10 grid-rows-[15rem_min-content_auto_10rem] full-container min-h-screen">
			<section className="content-column row-start-1 sticky top-0">
				<BaseGradientBlur position="top" size="15rem" fixed={false} layers={10} />
			</section>
			<section className="content-column row-start-1 sticky top-0 z-[1001]">
				<ComposedLayoutHeader type={type} frontmatter={frontmatter} />
			</section>
			<section className="col-span-full grid grid-cols-10">{children}</section>
			<section className="col-span-full"></section>
			<section className="content-column -row-start-2 relative z-[1001]">
				<ComposedLayoutFooter />
			</section>
		</main>
	);
}
