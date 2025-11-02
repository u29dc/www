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
		<div className="padding-standard grid grid-cols-10 h-60">
			<header className="col-span-base">
				<AtomicGradientBlur
					position="top"
					size="15rem"
					fixed={false}
					layers={10}
					className="z-1000"
				/>

				<div className="relative full-container uppercase z-1001">
					{type === 'index' && (
						<>
							<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
								<AnimatedStaggerBlur
									stageId="index-header"
									staggerDelay={50}
									blurStrength={5}
								>
									{siteTitle}
								</AnimatedStaggerBlur>
							</div>
							<nav className="absolute bottom-0 left-0">
								<AnimatedStaggerBlur stageId="index-header-nav">
									<AtomicBrandLogo
										className="translate-y-6 -translate-x-30"
										theme="light"
									/>
								</AnimatedStaggerBlur>
							</nav>
						</>
					)}

					{type === 'article' && frontmatter && (
						<>
							<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
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
