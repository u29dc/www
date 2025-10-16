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
import { SITE } from '@/lib/meta/config';
import type { HeaderProps } from '@/lib/types/components';

export function Header({ type, frontmatter, title }: HeaderProps) {
	const siteTitle = title ?? SITE.title;

	return (
		<header className="relative h-full p-5">
			<div className="relative full-container font-md">
				{type === 'page-home' && (
					<>
						<div className="header-title-centered">{siteTitle}</div>
						<nav className="header-nav-corner">
							<span>U29DC™</span>
						</nav>
					</>
				)}

				{type === 'page-content' && frontmatter && (
					<>
						<div className="header-title-centered">{frontmatter.title}</div>
						<nav className="header-nav-corner">
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
