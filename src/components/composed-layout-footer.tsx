/**
 * Composed Layout Footer Component
 *
 * ## SUMMARY
 * Displays social media links and contact navigation.
 *
 * ## RESPONSIBILITIES
 * - Render social media navigation links
 * - Handle external link attributes (target, rel)
 * - Provide consistent footer styling
 *
 * ## USAGE
 * ```tsx
 * <ComposedLayoutFooter />
 * ```
 *
 * @module components/composed-layout-footer
 */

export function ComposedLayoutFooter() {
	return (
		<footer className="relative h-full padding-standard">
			<nav className="flex flex-row gap-4">
				<a href="https://instagram.com/u29dc" target="_blank" rel="noopener noreferrer">
					Instagram
				</a>
				<a href="https://linkedin.com/in/u29dc" target="_blank" rel="noopener noreferrer">
					LinkedIn
				</a>
				<a href="https://cal.com/u29dc" target="_blank" rel="noopener noreferrer">
					Calendar
				</a>
			</nav>
		</footer>
	);
}
