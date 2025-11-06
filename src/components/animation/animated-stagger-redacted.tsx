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
 * - Orchestrate staggered overlay animations with sweep-synchronized timing and optional per-word spacing
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
	/** Additional spacing in milliseconds between sweep starts (0 = continuous). */
	msPerWord?: number;
}

// Animation timing configuration (milliseconds)
const PHASE1_COVER_GROW_DURATION = 50; // Left-to-right sweep
const PHASE2_TEXT_APPEAR_DURATION = 2; // Instant text deposit
const PHASE3_COVER_SHRINK_DURATION = 50; // Right-to-left reveal
const TOTAL_ANIMATION_DURATION =
	PHASE1_COVER_GROW_DURATION + PHASE2_TEXT_APPEAR_DURATION + PHASE3_COVER_SHRINK_DURATION;

/**
 * Animated Stagger Redacted Component
 *
 * Renders text with positioned overlays that animate via scaleX transform,
 * creating a rightward-shrinking reveal effect. Timeline-coordinated with
 * simple per-word timing control (contiguous sweep by default, configurable spacing via msPerWord).
 */
export function AnimatedStaggerRedacted({
	stageId,
	children,
	className,
	msPerWord = 0,
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

	// Per-word timing calculation: base sweep duration + optional extra spacing
	const coverSweepSeconds = PHASE1_COVER_GROW_DURATION / 1000;
	const extraSpacingSeconds = msPerWord / 1000;
	const perWordOffsetSeconds = coverSweepSeconds + extraSpacingSeconds;
	const totalDurationSeconds = TOTAL_ANIMATION_DURATION / 1000;

	// Keyframe timing distribution (0 = start, 1 = end)
	const phase1End = PHASE1_COVER_GROW_DURATION / TOTAL_ANIMATION_DURATION; // ~0.495
	const phase2End =
		(PHASE1_COVER_GROW_DURATION + PHASE2_TEXT_APPEAR_DURATION) / TOTAL_ANIMATION_DURATION; // ~0.505

	// Container variants propagate timeline variants
	const containerVariants = {
		hidden: {},
		visible: {},
	};

	// Text variants: opacity keyframes (appears at Phase 2)
	const textVariants = {
		hidden: { opacity: 0 },
		visible: (order: number) => ({
			opacity: [0, 0, 1, 1],
			transition: {
				duration: totalDurationSeconds,
				delay: order * perWordOffsetSeconds,
				times: [0, phase1End, phase2End, 1],
				ease: 'linear' as const,
			},
		}),
	};

	// Overlay variants: scaleX and originX keyframes to control sweep direction
	const overlayVariants = {
		hidden: { scaleX: 0, originX: 0 },
		visible: (order: number) => ({
			scaleX: [0, 1, 1, 0],
			originX: [0, 0, 1, 1],
			transition: {
				duration: totalDurationSeconds,
				delay: order * perWordOffsetSeconds,
				times: [0, phase1End, phase2End, 1],
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
			className={
				mergedClassName ? `animation-redacted ${mergedClassName}` : 'animation-redacted'
			}
			initial={false}
			animate={variant}
			variants={containerVariants}
			aria-hidden="true"
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
						<motion.span
							className="inline-block"
							variants={textVariants}
							custom={wordRevealOrder}
						>
							{word}
						</motion.span>
						<motion.span
							className="-right-1 cover-hatch absolute top-0 bottom-0 left-0 transform-gpu will-change-transform"
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
