'use client';

/**
 * Animated Feed Wrapper
 *
 * ## SUMMARY
 * Timeline-coordinated wrapper with staggered Motion animations for feed items.
 * Includes sliding hover indicator for visual feedback.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, orchestrate staggered item animations, notify on completion
 * - Manage hover state and render sliding indicator element
 *
 * @module components/animation/animated-feed-wrapper
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement, useMemo, useState } from 'react';
import { logEvent } from '@/lib/logger';
import { useTimelineStage } from '@/lib/timeline';

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
	staggerDelay = 0,
}: AnimatedFeedWrapperProps) {
	const { stage, variant, advanceStage, stageConfig } = useTimelineStage(stageId);

	// Hover indicator state
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	// Memoize children array for stable dependency
	const childArray = useMemo(() => Children.toArray(children), [children]);

	// Auto-calculate stagger timing from timeline config
	const actualStaggerDelay = useMemo(() => {
		// Use manual override if provided (non-zero)
		if (staggerDelay !== 0) {
			return staggerDelay;
		}

		const configDuration = stageConfig?.duration ?? 1000;

		// Calculate optimal timing to fill the configured duration
		const ITEM_ANIMATION_DURATION = 500;
		const MIN_STAGGER = 5;
		const MAX_STAGGER = 300;

		const itemCount = childArray.length;
		const availableTime = Math.max(0, configDuration - ITEM_ANIMATION_DURATION);

		const calculatedStagger = itemCount > 1 ? availableTime / (itemCount - 1) : 0;
		const constrainedStagger = Math.max(MIN_STAGGER, Math.min(MAX_STAGGER, calculatedStagger));

		if (Math.abs(constrainedStagger - calculatedStagger) > 1) {
			logEvent('TIMELINE', 'STAGGER_CONSTRAINED', 'WARN', {
				stageId,
				calculated: calculatedStagger,
				constrained: constrainedStagger,
				configDuration,
				itemCount,
			});
		}

		return constrainedStagger;
	}, [staggerDelay, stageConfig, stageId, childArray]);

	const containerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: actualStaggerDelay / 1000,
			},
		},
	};

	const itemVariants = {
		hidden: {
			opacity: 0,
			y: 10,
			filter: 'blur(5px)',
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

	const lastIndex = childArray.length - 1;

	const handleComplete = () => {
		if (stage?.status === 'animating') {
			advanceStage();
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
			onMouseLeave={() => setHoveredIndex(null)}
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
						onMouseEnter={() => setHoveredIndex(index)}
						className="relative"
						{...(index === lastIndex && { onAnimationComplete: handleComplete })}
					>
						{/* Hover indicator positioned within hovered item */}
						{hoveredIndex === index && (
							<motion.div
								layoutId="feed-hover-indicator"
								className="pointer-events-none absolute -left-8 top-1/2 translate-y-[-50%] h-[5px] w-[5px] rounded-full bg-current"
								transition={{
									layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
								}}
							/>
						)}
						{child}
					</motion.div>
				);
			})}
		</motion.div>
	);
}
