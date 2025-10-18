'use client';

/**
 * Animated Section
 *
 * ## SUMMARY
 * Timeline-coordinated section with direction-aware animations using Motion.
 *
 * ## RESPONSIBILITIES
 * - Connect to timeline store for reactive stage state
 * - Play direction-aware animations (enter fades up, exit fades down)
 * - Notify timeline orchestrator on animation completion
 * - Skip animations when reduced motion is enabled
 *
 * ## USAGE
 * ```tsx
 * import { AnimatedSection } from '@/components/base-animated-section';
 *
 * <TimelineProvider config={homeTimeline}>
 *   <AnimatedSection stageId="hero">
 *     <h1>Hero Content</h1>
 *   </AnimatedSection>
 * </TimelineProvider>
 * ```
 *
 * @module components/base-animated-section
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import type { StageState } from '@/lib/animation/timeline';
import { useTimeline } from '@/lib/animation/timeline';
import { logEvent } from '@/lib/utils/logger';

export interface AnimatedSectionProps {
	stageId: string;
	children: ReactNode;
	className?: string;
}

/**
 * AnimatedSection component
 *
 * Timeline-coordinated section with direction-aware animations.
 * Enter animations fade up, exit animations fade down.
 */
export function AnimatedSection({ stageId, children, className }: AnimatedSectionProps) {
	const { store, advanceStage } = useTimeline();

	// Subscribe to stage state changes
	const stage = useSyncExternalStore(
		store.subscribe,
		() => store.getState(stageId),
		() => undefined,
	);

	// Determine animation variant based on stage state
	const getVariant = (state: StageState | undefined): string => {
		if (!state) return 'hidden';

		if (state.direction === 'enter') {
			return state.status === 'complete'
				? 'visible'
				: state.status === 'animating'
					? 'visible'
					: 'hidden';
		}

		// Exit direction - animate to and stay hidden
		return 'hidden';
	};

	const variant = getVariant(stage);

	// Animation variants - direction-aware
	const variants = {
		hidden: {
			opacity: 0,
			y: stage?.direction === 'exit' ? 10 : -10, // Exit fades down, enter fades up
			filter: 'blur(10px)',
		},
		visible: {
			opacity: 1,
			y: 0,
			filter: 'blur(0px)',
		},
	};

	return (
		<motion.div
			className={className}
			initial={false} // Hydration-safe
			animate={variant}
			variants={variants}
			transition={{
				duration: 0.6,
				ease: [0.22, 1, 0.36, 1],
			}}
			onAnimationComplete={() => {
				if (stage?.status === 'animating') {
					advanceStage(stageId);
					logEvent('TIMELINE', 'SECTION_ANIMATE', 'COMPLETE', {
						stageId,
						direction: stage.direction,
					});
				}
			}}
		>
			{children}
		</motion.div>
	);
}
