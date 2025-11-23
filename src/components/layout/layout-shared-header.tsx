/**
 * Layout Shared Header
 *
 * ## SUMMARY
 * Header with timeline-aware AnimatedReveal title and optional back button.
 *
 * ## RESPONSIBILITIES
 * - Render site or article header with animated title and navigation
 *
 * @module components/layout/layout-shared-header
 */

import { AnimatedLink } from '@/components/animation/animated-link';
import { AnimatedStaggerBlur } from '@/components/animation/animated-stagger-blur';
import { AtomicBrandLogo } from '@/components/atomic/atomic-brand-logo';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { SITE } from '@/lib/constants';
import type { ContentItem } from '@/lib/mdx-types';

export interface LayoutSharedHeaderProps {
	type: 'index' | 'article';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

export function LayoutSharedHeader({ type, frontmatter, title }: LayoutSharedHeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<div className="padding-standard grid h-60 grid-cols-10">
			<header className="col-span-base">
				<AtomicGradientBlur
					position="top"
					size="15rem"
					fixed={true}
					layers={5}
					className="z-0"
				/>

				<div className="full-container relative z-10 uppercase">
					{type === 'index' && (
						<>
							<div className="-translate-x-1/2 absolute bottom-0 left-1/2 w-full text-center">
								<AnimatedStaggerBlur
									stageId="index-header"
									staggerDelay={50}
									blurStrength={5}
								>
									{siteTitle}
								</AnimatedStaggerBlur>
							</div>
							<nav className="absolute bottom-0 left-0">
								<AtomicBrandLogo
									className="-translate-x-30 translate-y-6"
									theme="light"
								/>
							</nav>
						</>
					)}

					{type === 'article' && frontmatter && (
						<>
							<div className="-translate-x-1/2 absolute bottom-0 left-1/2 w-full text-center">
								<AnimatedStaggerBlur
									stageId="article-header"
									staggerDelay={50}
									blurStrength={5}
								>
									{frontmatter.title}
								</AnimatedStaggerBlur>
							</div>
							<nav className="absolute bottom-0 left-0">
								<AnimatedStaggerBlur stageId="article-header-nav">
									<AnimatedLink href="/">Back</AnimatedLink>
								</AnimatedStaggerBlur>
							</nav>
						</>
					)}
				</div>
			</header>
		</div>
	);
}
