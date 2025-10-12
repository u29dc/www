/**
 * Site and Content Header Component
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
 * <Header /> // Site header
 * <Header frontmatter={content} /> // Content header
 * ```
 *
 * @module components/ui/header
 */

import Link from 'next/link';
import type { ContentItem } from '@/lib/types/content';
import { SITE } from '@/lib/utils/metadata';

interface HeaderProps {
	type: 'page-home' | 'page-content';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

export function Header({ type, frontmatter, title }: HeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<header className="relative h-full p-5">
			<div className="relative h-full w-full font-md">
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
