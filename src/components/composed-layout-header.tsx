'use client';

/**
 * Composed Layout Header Component
 *
 * ## SUMMARY
 * Displays site title or content title with back button based on context.
 * Timeline-aware with AnimatedReveal for header text.
 *
 * ## RESPONSIBILITIES
 * - Render site header with title
 * - Render content header with title, description, and back button
 * - Handle navigation back to home
 * - Coordinate header animation with timeline stages
 *
 * ## USAGE
 * ```tsx
 * <ComposedLayoutHeader type="page-home" /> // Site header
 * <ComposedLayoutHeader type="page-content" frontmatter={content} /> // Content header
 * ```
 *
 * @module components/composed-layout-header
 */

import { AnimatedLink } from '@/components/base-animated-link';
import { AnimatedReveal } from '@/components/base-animated-reveal';
import type { ContentItem } from '@/lib/mdx/types';
import { SITE } from '@/lib/meta/config';

/** Composed layout header component props */
export interface ComposedLayoutHeaderProps {
	type: 'page-home' | 'page-content';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

export function ComposedLayoutHeader({ type, frontmatter, title }: ComposedLayoutHeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<header className="relative h-full padding-standard">
			<div className="relative full-container font-md">
				{type === 'page-home' && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedReveal
								stageId="home-header"
								staggerDelay={15}
								blurStrength={8}
							>
								{siteTitle}
							</AnimatedReveal>
						</div>
						<nav className="absolute bottom-0 left-0">
							<span>U29DC™</span>
						</nav>
					</>
				)}

				{type === 'page-content' && frontmatter && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							<AnimatedReveal
								stageId="content-header"
								staggerDelay={15}
								blurStrength={8}
							>
								{frontmatter.title}
							</AnimatedReveal>
						</div>
						<nav className="absolute bottom-0 left-0">
							<AnimatedLink href="/">Back</AnimatedLink>
						</nav>
					</>
				)}
			</div>
		</header>
	);
}
