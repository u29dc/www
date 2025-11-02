'use client';

/**
 * Animated Stagger Redacted
 *
 * ## SUMMARY
 * Timeline-coordinated word reveal animation where opaque overlays shrink rightward
 * to progressively reveal text, creating a redacted-document-style reveal effect.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage and split text into words
 * - Render positioned overlays that animate from full coverage (scaleX: 1) to revealed (scaleX: 0)
 * - Orchestrate staggered overlay animations with auto-calculated timing
 * - Advance timeline stage when final word overlay completes animation
 *
 * @module components/animation/animated-stagger-redacted
 */

import { motion } from 'motion/react';
import { isValidElement, type ReactNode } from 'react';
import { extractTextContent, findLastWordIndex, isWhitespace, splitTextIntoWords } from '@/lib/dom';
import { useTimelineStage } from '@/lib/timeline';

export interface AnimatedStaggerRedactedProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
}

// Animation timing constraints
const MIN_STAGGER = 1;
const MAX_STAGGER = 10;
const OVERLAY_ANIMATION_DURATION = 20;

/**
 * Animated Stagger Redacted Component
 *
 * Renders text with positioned overlays that animate via scaleX transform,
 * creating a rightward-shrinking reveal effect. Timeline-coordinated with
 * automatic stagger timing calculation based on stage duration.
 */
export function AnimatedStaggerRedacted({
	stageId,
	children,
	className,
	staggerDelay,
}: AnimatedStaggerRedactedProps) {
	// Subscribe to timeline stage for animation coordination
	const { variant, advanceStage, stageConfig } = useTimelineStage(stageId);

	// Extract and split text content into words
	const textContent = extractTextContent(children);
	const words = splitTextIntoWords(textContent);

	// Find last non-whitespace word for completion handling
	const lastWordIndex = findLastWordIndex(words);

	// Extract className from children if it's a ReactElement
	let childClassName = '';
	if (isValidElement(children)) {
		const childProps = children.props as { className?: unknown };
		if (typeof childProps.className === 'string') {
			childClassName = childProps.className;
		}
	}
	const mergedClassName = className ? `${className} ${childClassName}`.trim() : childClassName;

	// Auto-calculate stagger timing from stage duration if not provided
	const wordCount = words.filter((w) => !isWhitespace(w)).length;
	const availableTime = Math.max(0, (stageConfig?.duration ?? 1000) - OVERLAY_ANIMATION_DURATION);

	// Distribute available time across word gaps (n-1 gaps for n words)
	const autoStagger = wordCount > 1 ? availableTime / (wordCount - 1) : 0;

	// Use provided stagger or calculated value, constrain to min/max bounds
	const calculatedStagger = staggerDelay ?? autoStagger;
	const boundedStaggerMs = Math.max(MIN_STAGGER, Math.min(MAX_STAGGER, calculatedStagger));
	const boundedStaggerSeconds = boundedStaggerMs / 1000; // Convert to seconds for Motion
	const overlayDurationSeconds = OVERLAY_ANIMATION_DURATION / 1000;
	const sweepDelaySeconds = overlayDurationSeconds + boundedStaggerSeconds;

	// Container variants propagate timeline variants; per-word delays handled via custom timing
	const containerVariants = {
		hidden: {},
		visible: {},
	};

	// Overlay variants for scaleX transform animation
	const overlayVariants = {
		hidden: { scaleX: 1 }, // Fully covers text
		visible: (order: number) => ({
			scaleX: 0, // Shrinks to reveal text
			transition: {
				duration: overlayDurationSeconds,
				delay: order * sweepDelaySeconds,
				ease: 'linear',
			},
		}),
	};

	/**
	 * Advance timeline stage when final overlay completes animation.
	 * Only called by the last word's overlay via onAnimationComplete.
	 */
	const handleComplete = () => {
		advanceStage();
	};

	let revealOrder = 0;

	return (
		<motion.div
			className={mergedClassName || undefined}
			initial={false}
			animate={variant}
			variants={containerVariants}
		>
			{words.map((word, index) => {
				// Skip whitespace - we removed padding to eliminate gaps between overlays
				if (isWhitespace(word)) {
					return null;
				}

				// Check if this is the last non-whitespace word for completion handling
				const isLastWord = index === lastWordIndex;
				const wordRevealOrder = revealOrder;
				revealOrder += 1;

				return (
					<motion.span
						key={`word-${
							// biome-ignore lint/suspicious/noArrayIndexKey: stable within text
							index
						}`}
						className="relative inline-block pr-1"
						variants={{
							hidden: {},
							visible: {},
						}}
					>
						{word}
						<motion.span
							className="bg-black absolute inset-0 origin-right"
							variants={overlayVariants}
							custom={wordRevealOrder}
							{...(isLastWord && { onAnimationComplete: handleComplete })}
						/>
					</motion.span>
				);
			})}
		</motion.div>
	);
}
