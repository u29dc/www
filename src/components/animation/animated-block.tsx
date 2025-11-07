'use client';

/**
 * Animated Block
 *
 * ## SUMMARY
 * Timeline-coordinated block with direction-aware Motion animations.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, play direction-aware animations, notify on completion
 *
 * @module components/animation/animated-block
 */

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { logEvent } from '@/lib/logger';
import { useDeviceTier } from '@/lib/performance';
import { useTimelineStage } from '@/lib/timeline';

export interface AnimatedBlockProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	duration?: number;
	/** Whether to enable blur animations. Auto-disabled on low-tier devices or with reduced-motion preference. Default: true. */
	enableBlur?: boolean;
}

export function AnimatedBlock({
	stageId,
	children,
	className,
	duration = 0,
	enableBlur = true,
}: AnimatedBlockProps) {
	const { stage, variant, advanceStage, stageConfig, isExit } = useTimelineStage(stageId);

	// Device-aware blur detection (reactive to motion preference changes)
	const tier = useDeviceTier();
	const prefersReducedMotion = useReducedMotion();
	const blurAllowed = enableBlur && tier !== 'low' && !prefersReducedMotion;

	// Auto-calculate duration from timeline config
	const actualDuration = useMemo(() => {
		// Use manual override if provided (non-zero)
		if (duration !== 0) {
			return duration;
		}

		const configDuration = stageConfig?.duration ?? 600;

		// Apply sensible constraints for fade animations
		const MIN_DURATION = 100;
		const MAX_DURATION = 2000;

		const constrainedDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, configDuration));

		if (Math.abs(constrainedDuration - configDuration) > 1) {
			logEvent('TIMELINE', 'DURATION_CONSTRAINED', 'WARN', {
				stageId,
				calculated: configDuration,
				constrained: constrainedDuration,
			});
		}

		return constrainedDuration;
	}, [duration, stageConfig, stageId]);

	const variants = useMemo(
		() => ({
			hidden: {
				opacity: 0,
				y: isExit ? 10 : -10, // Exit fades down, enter fades up
				// Conditionally apply blur filter
				...(blurAllowed && { filter: 'blur(5px)' }),
			},
			visible: {
				opacity: 1,
				y: 0,
				filter: 'blur(0px)',
			},
		}),
		[isExit, blurAllowed],
	);

	return (
		<motion.div
			className={className}
			initial={false}
			animate={variant}
			variants={variants}
			transition={{
				duration: actualDuration / 1000,
				ease: [0.22, 1, 0.36, 1],
			}}
			onAnimationComplete={() => {
				if (stage?.status === 'animating') {
					advanceStage();
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
