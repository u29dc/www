/**
 * Layout Shared Footer
 *
 * ## SUMMARY
 * Footer with social media and contact navigation links.
 *
 * ## RESPONSIBILITIES
 * - Render social media links with external link attributes
 *
 * @module components/layout/layout-shared-footer
 */

import { AnimatedBlock } from '@/components/animation/animated-block';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';

export function LayoutSharedFooter() {
	return (
		<footer className="relative h-full padding-standard">
			<AnimatedBlock stageId="layout-footer-nav">
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
			</AnimatedBlock>

			<AtomicGradientBlur />
		</footer>
	);
}
