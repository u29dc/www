'use client';

/**
 * Animated Feed Wrapper
 *
 * ## SUMMARY
 * Timeline-coordinated wrapper for feed items with staggered entrance animations.
 *
 * ## RESPONSIBILITIES
 * - Connect to timeline store for reactive stage state
 * - Wrap children in Motion containers with stagger effect
 * - Orchestrate overlapping item animations
 * - Notify timeline orchestrator on completion
 *
 * ## USAGE
 * ```tsx
 * <AnimatedFeedWrapper stageId="home-feed" staggerDelay={80}>
 *   {items.map(item => <FeedItem key={item.id} item={item} />)}
 * </AnimatedFeedWrapper>
 * ```
 *
 * @module components/base-animated-feed-wrapper
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement, useSyncExternalStore } from 'react';
import type { StageState } from '@/lib/animation/timeline';
import { useTimeline } from '@/lib/animation/timeline';
import { logEvent } from '@/lib/utils/logger';

export interface AnimatedFeedWrapperProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
}

/**
 * AnimatedFeedWrapper component
 *
 * Timeline-coordinated feed wrapper with staggered item animations.
 * Each child animates in with subtle overlap.
 */
export function AnimatedFeedWrapper({
	stageId,
	children,
	className,
	staggerDelay = 80,
}: AnimatedFeedWrapperProps) {
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

	// Container variants with stagger
	const containerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: staggerDelay / 1000,
			},
		},
	};

	// Item variants
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

	// Convert children to array
	const childArray = Children.toArray(children);
	const lastIndex = childArray.length - 1;

	// Completion handler
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
				// Extract key from child element
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
