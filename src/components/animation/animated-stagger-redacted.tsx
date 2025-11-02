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
 * - Orchestrate staggered overlay animations with simple per-word timing (default: 5ms)
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
	msPerWord?: number;
}

// Animation timing configuration
const OVERLAY_ANIMATION_DURATION = 20;

/**
 * Animated Stagger Redacted Component
 *
 * Renders text with positioned overlays that animate via scaleX transform,
 * creating a rightward-shrinking reveal effect. Timeline-coordinated with
 * simple per-word timing control (default: 5ms between word reveals).
 */
export function AnimatedStaggerRedacted({
	stageId,
	children,
	className,
	msPerWord = 20,
}: AnimatedStaggerRedactedProps) {
	// Subscribe to timeline stage for animation coordination
	const { variant, advanceStage } = useTimelineStage(stageId);

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

	// Simple per-word timing calculation
	const staggerSeconds = msPerWord / 1000; // Convert milliseconds to seconds for Motion
	const overlayDurationSeconds = OVERLAY_ANIMATION_DURATION / 1000;

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
				delay: order * staggerSeconds,
				ease: 'linear' as const,
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
						className="relative inline-block pr-1 contain-layout"
						variants={{
							hidden: {},
							visible: {},
						}}
					>
						{word}
						<motion.span
							className="absolute top-0 bottom-0 left-0 -right-1 origin-right will-change-transform transform-gpu cover-hatch"
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
