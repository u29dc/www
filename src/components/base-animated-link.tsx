'use client';

/**
 * Animated Link
 *
 * ## SUMMARY
 * Navigation link with exit animation coordination and synchronous mode switching.
 *
 * ## RESPONSIBILITIES
 * - Set navigation mode synchronously before navigation
 * - Trigger exit animations via timeline orchestrator
 * - Prevent concurrent navigation with global lock
 * - Navigate after exit animation completes
 *
 * ## USAGE
 * ```tsx
 * import { AnimatedLink } from '@/components/base-animated-link';
 *
 * <AnimatedLink href="/about" className="nav-link">
 *   About
 * </AnimatedLink>
 * ```
 *
 * @module components/base-animated-link
 */

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useNavigationMode, useTimeline } from '@/lib/animation/timeline';
import { logEvent } from '@/lib/utils/logger';

/**
 * Global navigation lock to prevent concurrent transitions
 */
let isNavigating = false;

export interface AnimatedLinkProps {
	href: string;
	children: ReactNode;
	className?: string;
}

/**
 * AnimatedLink component
 *
 * Navigation link with exit animation coordination.
 * Sets navigation mode synchronously before triggering exit animations.
 */
export function AnimatedLink({ href, children, className }: AnimatedLinkProps) {
	const router = useRouter();
	const { setMode } = useNavigationMode();
	const { playDirection } = useTimeline();

	const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault();

		// Prevent concurrent navigation
		if (isNavigating) {
			logEvent('TIMELINE', 'LINK_CLICK', 'SKIP', { href, reason: 'concurrent' });
			return;
		}

		isNavigating = true;

		try {
			// Set mode synchronously before navigation
			setMode('in-app');
			logEvent('TIMELINE', 'LINK_CLICK', 'SUCCESS', { href });

			// Play exit animation
			await playDirection('exit', 'in-app');

			// Navigate after exit completes
			router.push(href);
		} catch (error) {
			logEvent('TIMELINE', 'LINK_NAVIGATE', 'ERROR', { href, error });
		} finally {
			// Release lock after short delay (allow navigation to start)
			setTimeout(() => {
				isNavigating = false;
			}, 100);
		}
	};

	return (
		<a href={href} onClick={handleClick} className={className}>
			{children}
		</a>
	);
}
