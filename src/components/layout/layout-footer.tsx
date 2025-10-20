/**
 * Layout Footer
 *
 * ## SUMMARY
 * Footer with social media and contact navigation links.
 *
 * ## RESPONSIBILITIES
 * - Render social media links with external link attributes
 *
 * @module components/layout/layout-footer
 */

import { AnimatedSection } from '@/components/animation/animated-section';

export function LayoutFooter() {
	return (
		<footer className="relative h-full padding-standard">
			<AnimatedSection stageId="layout-footer-nav">
				<nav className="flex flex-row gap-4">
					<a href="https://instagram.com/u29dc" target="_blank" rel="noopener noreferrer">
						Instagram
					</a>
					<a
						href="https://linkedin.com/in/u29dc"
						target="_blank"
						rel="noopener noreferrer"
					>
						LinkedIn
					</a>
					<a href="https://cal.com/u29dc" target="_blank" rel="noopener noreferrer">
						Calendar
					</a>
				</nav>
			</AnimatedSection>
		</footer>
	);
}
