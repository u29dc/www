'use client';

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
import { AnimatedStagger } from '@/components/animation/animated-stagger';
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
		<header className="relative h-full padding-standard">
			<AtomicGradientBlur
				position="top"
				size="15rem"
				fixed={false}
				layers={10}
				className="z-1000"
			/>

			<div className="relative full-container font-md z-1001">
				{type === 'index' && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedStagger
								stageId="index-header"
								staggerDelay={50}
								blurStrength={5}
							>
								{siteTitle}
							</AnimatedStagger>
						</div>
						<nav className="absolute bottom-0 left-0">
							<AnimatedStagger stageId="index-header-nav">
								<AtomicBrandLogo className="translate-y-6 -translate-x-30" />
							</AnimatedStagger>
						</nav>
					</>
				)}

				{type === 'article' && frontmatter && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedStagger
								stageId="article-header"
								staggerDelay={50}
								blurStrength={5}
							>
								{frontmatter.title}
							</AnimatedStagger>
						</div>
						<nav className="absolute bottom-0 left-0">
							<AnimatedStagger stageId="article-header-nav">
								<AnimatedLink href="/">Back</AnimatedLink>
							</AnimatedStagger>
						</nav>
					</>
				)}
			</div>
		</header>
	);
}
