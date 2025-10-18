'use client';

/**
 * Animated Section
 *
 * ## SUMMARY
 * Timeline-coordinated section with direction-aware Motion animations.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, play direction-aware animations, notify on completion
 *
 * @module components/animation/animated-section
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { logEvent } from '@/lib/logger';
import type { StageState } from '@/lib/timeline';
import { useTimeline } from '@/lib/timeline';

export interface AnimatedSectionProps {
	stageId: string;
	children: ReactNode;
	className?: string;
}

export function AnimatedSection({ stageId, children, className }: AnimatedSectionProps) {
	const { store, advanceStage } = useTimeline();

	const stage = useSyncExternalStore(
		store.subscribe,
		() => store.getState(stageId),
		() => undefined,
	);

	const getVariant = (state: StageState | undefined): string => {
		if (!state) return 'hidden';

		if (state.direction === 'enter') {
			return state.status === 'complete'
				? 'visible'
				: state.status === 'animating'
					? 'visible'
					: 'hidden';
		}

		return 'hidden';
	};

	const variant = getVariant(stage);

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
			initial={false}
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
