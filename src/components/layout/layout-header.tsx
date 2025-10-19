'use client';

/**
 * Layout Header
 *
 * ## SUMMARY
 * Header with timeline-aware AnimatedReveal title and optional back button.
 *
 * ## RESPONSIBILITIES
 * - Render site or article header with animated title and navigation
 *
 * @module components/layout/layout-header
 */

import { AnimatedLink } from '@/components/animation/animated-link';
import { AnimatedReveal } from '@/components/animation/animated-reveal';
import { AtomicBrandLogo } from '@/components/atomic/atomic-brand-logo';
import { SITE } from '@/lib/constants';
import type { ContentItem } from '@/lib/mdx-types';

export interface LayoutHeaderProps {
	type: 'index' | 'article';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

export function LayoutHeader({ type, frontmatter, title }: LayoutHeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<header className="relative h-full padding-standard">
			<div className="relative full-container font-md">
				{type === 'index' && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedReveal
								stageId="index-header"
								staggerDelay={50}
								blurStrength={5}
							>
								{siteTitle}
							</AnimatedReveal>
						</div>
						<nav className="absolute bottom-0 left-0">
							<AnimatedReveal stageId="index-header-nav">
								<AtomicBrandLogo className="translate-y-[1.5rem] -translate-x-[7.5rem]" />
							</AnimatedReveal>
						</nav>
					</>
				)}

				{type === 'article' && frontmatter && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedReveal
								stageId="article-header"
								staggerDelay={50}
								blurStrength={5}
							>
								{frontmatter.title}
							</AnimatedReveal>
						</div>
						<nav className="absolute bottom-0 left-0">
							<AnimatedReveal stageId="article-header-nav">
								<AnimatedLink href="/">Back</AnimatedLink>
							</AnimatedReveal>
						</nav>
					</>
				)}
			</div>
		</header>
	);
}
