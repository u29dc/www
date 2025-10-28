'use client';

/**
 * Animated Content Feed
 *
 * ## SUMMARY
 * Timeline-coordinated wrapper with staggered Motion animations for feed items.
 * Includes sliding hover indicator for visual feedback.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, orchestrate staggered item animations, notify on completion
 * - Manage hover state and render sliding indicator element
 *
 * @module components/animation/animated-content-feed
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement, useMemo, useState } from 'react';
import { AnimatedContentFeedThumbnail } from '@/components/animation/animated-content-feed_thumbnail';
import { logEvent } from '@/lib/logger';
import { useTimelineStage } from '@/lib/timeline';

export interface AnimatedContentFeedProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
	thumbnails?: (string | null)[];
}

export function AnimatedContentFeed({
	stageId,
	children,
	className,
	staggerDelay = 0,
	thumbnails,
}: AnimatedContentFeedProps) {
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
			className={`${className} overflow-visible`}
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
						className="relative overflow-visible"
						{...(index === lastIndex && { onAnimationComplete: handleComplete })}
					>
						{/* Hover indicators and thumbnail positioned within hovered item */}
						{hoveredIndex === index && (
							<div className="hidden hover-device:block">
								<motion.div
									layoutId="feed-hover-indicator-left"
									className="pointer-events-none absolute left-2 md:left-5 top-1/2 translate-y-[-50%] h-[1px] w-[1px] bg-current"
									transition={{
										layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
									}}
								/>
								<motion.div
									layoutId="feed-hover-indicator-right"
									className="pointer-events-none absolute right-2 md:right-5 top-1/2 translate-y-[-50%] h-[1px] w-[10px] bg-current"
									transition={{
										layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
									}}
								/>
								<AnimatedContentFeedThumbnail
									thumbnailUrl={thumbnails?.[index] ?? null}
								/>
							</div>
						)}
						{child}
					</motion.div>
				);
			})}
		</motion.div>
	);
}
