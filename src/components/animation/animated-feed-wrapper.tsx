'use client';

/**
 * Animated Feed Wrapper
 *
 * ## SUMMARY
 * Timeline-coordinated wrapper with staggered Motion animations for feed items.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, orchestrate staggered item animations, notify on completion
 *
 * @module components/animation/animated-feed-wrapper
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement, useSyncExternalStore } from 'react';
import { logEvent } from '@/lib/logger';
import type { StageState } from '@/lib/timeline';
import { useTimeline } from '@/lib/timeline';

export interface AnimatedFeedWrapperProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
}

export function AnimatedFeedWrapper({
	stageId,
	children,
	className,
	staggerDelay = 80,
}: AnimatedFeedWrapperProps) {
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

	const containerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: staggerDelay / 1000,
			},
		},
	};

	const itemVariants = {
		hidden: {
			opacity: 0,
			y: 10,
			filter: 'blur(4px)',
		},
		visible: {
			opacity: 1,
			y: 0,
			filter: 'blur(0px)',
			transition: {
				duration: 0.5,
				ease: [0.22, 1, 0.36, 1] as const,
			},
		},
	};

	const childArray = Children.toArray(children);
	const lastIndex = childArray.length - 1;

	const handleComplete = () => {
		if (stage?.status === 'animating') {
			advanceStage(stageId);
			logEvent('TIMELINE', 'FEED_ANIMATE', 'COMPLETE', {
				stageId,
				direction: stage.direction,
				itemCount: childArray.length,
			});
		}
	};

	return (
		<motion.div
			className={className}
			initial={false}
			animate={variant}
			variants={containerVariants}
		>
			{childArray.map((child, index) => {
				const childKey =
					isValidElement(child) && (child as ReactElement).key
						? (child as ReactElement).key
						: index;

				return (
					<motion.div
						key={childKey}
						variants={itemVariants}
						{...(index === lastIndex && { onAnimationComplete: handleComplete })}
					>
						{child}
					</motion.div>
				);
			})}
		</motion.div>
	);
}
