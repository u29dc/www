/**
 * Composed Layout Header Component
 *
 * ## SUMMARY
 * Displays site title or content title with back button based on context.
 *
 * ## RESPONSIBILITIES
 * - Render site header with title
 * - Render content header with title, description, and back button
 * - Handle navigation back to home
 *
 * ## USAGE
 * ```tsx
 * <ComposedLayoutHeader /> // Site header
 * <ComposedLayoutHeader frontmatter={content} /> // Content header
 * ```
 *
 * @module components/composed-layout-header
 */

import Link from 'next/link';
import { SITE } from '@/lib/meta/config';
import type { ComposedLayoutHeaderProps } from '@/lib/types/components';

export function ComposedLayoutHeader({ type, frontmatter, title }: ComposedLayoutHeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<header className="relative h-full padding-standard">
			<div className="relative full-container font-md">
				{type === 'page-home' && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							{siteTitle}
						</div>
						<nav className="absolute bottom-0 left-0">
							<span>U29DC™</span>
						</nav>
					</>
				)}

				{type === 'page-content' && frontmatter && (
					<>
						<div className="absolute bottom-0 w-full left-1/2 -translate-x-1/2 text-center">
							{frontmatter.title}
						</div>
						<nav className="absolute bottom-0 left-0">
							<Link href="/">
								<span>Back</span>
							</Link>
						</nav>
					</>
				)}
			</div>
		</header>
	);
}
