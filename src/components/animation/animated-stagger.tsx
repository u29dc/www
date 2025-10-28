'use client';

/**
 * Animated Stagger
 *
 * ## SUMMARY
 * Timeline-coordinated word-by-word stagger with staggered Motion animations.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, split text into words, orchestrate staggered animations
 *
 * @module components/animation/animated-stagger
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement, useCallback, useMemo } from 'react';
import { logEvent } from '@/lib/logger';
import { useTimelineStage } from '@/lib/timeline';

export interface AnimatedStaggerProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
	elementStagger?: number;
	blurStrength?: number;
	yOffset?: number;
}

const MIN_STAGGER = 5;
const MAX_STAGGER = 300;
const WORD_ANIMATION_DURATION = 600;

function calculateWordOnlyStagger(
	cachedWords: string[],
	availableTime: number,
	stageId: string,
	configDuration: number,
): number {
	const wordCount = cachedWords.filter((w) => !/^\s+$/.test(w)).length;
	const calculatedStagger = wordCount > 1 ? availableTime / (wordCount - 1) : 0;
	const constrainedStagger = Math.max(MIN_STAGGER, Math.min(MAX_STAGGER, calculatedStagger));

	if (Math.abs(constrainedStagger - calculatedStagger) > 1) {
		logEvent('TIMELINE', 'STAGGER_CONSTRAINED', 'WARN', {
			stageId,
			calculated: calculatedStagger,
			constrained: constrainedStagger,
			configDuration,
		});
	}

	return constrainedStagger;
}

function calculateElementAndWordStagger(
	childArray: ReactNode[],
	elementTextCache: Map<number, { text: string; words: string[] }>,
	availableTime: number,
	stageId: string,
	configDuration: number,
): { elementStagger: number; wordStagger: number } {
	const elementCount = childArray.length;
	const avgWordsPerElement =
		Array.from(elementTextCache.values()).reduce(
			(sum, { words }) => sum + words.filter((w: string) => !/^\s+$/.test(w)).length,
			0,
		) / Math.max(1, elementTextCache.size);

	// Distribute time: 60% for element stagger, 40% for word stagger
	const elementTime = availableTime * 0.6;
	const wordTime = availableTime * 0.4;

	const calculatedElementStagger = elementCount > 1 ? elementTime / (elementCount - 1) : 0;
	const calculatedWordStagger = avgWordsPerElement > 1 ? wordTime / (avgWordsPerElement - 1) : 0;

	const constrainedElementStagger = Math.max(
		MIN_STAGGER,
		Math.min(MAX_STAGGER, calculatedElementStagger),
	);
	const constrainedWordStagger = Math.max(
		MIN_STAGGER,
		Math.min(MAX_STAGGER, calculatedWordStagger),
	);

	if (
		Math.abs(constrainedElementStagger - calculatedElementStagger) > 1 ||
		Math.abs(constrainedWordStagger - calculatedWordStagger) > 1
	) {
		logEvent('TIMELINE', 'STAGGER_CONSTRAINED', 'WARN', {
			stageId,
			elementStagger: {
				calculated: calculatedElementStagger,
				constrained: constrainedElementStagger,
			},
			wordStagger: {
				calculated: calculatedWordStagger,
				constrained: constrainedWordStagger,
			},
			configDuration,
		});
	}

	return {
		elementStagger: constrainedElementStagger,
		wordStagger: constrainedWordStagger,
	};
}

export function AnimatedStagger({
	stageId,
	children,
	className,
	staggerDelay = 0,
	elementStagger = 0,
	blurStrength = 10,
	yOffset = 5,
}: AnimatedStaggerProps) {
	const { stage, variant, advanceStage, stageConfig } = useTimelineStage(stageId);

	const childArray = useMemo(() => Children.toArray(children), [children]);
	const hasElements = useMemo(
		() => childArray.some((child) => isValidElement(child)),
		[childArray],
	);

	const childrenText = useMemo(() => String(children), [children]);
	const cachedWords = useMemo(() => {
		if (hasElements) return [];
		return childrenText.split(/(\s+)/);
	}, [hasElements, childrenText]);

	const extractTextContent = useCallback((node: ReactNode): string => {
		if (typeof node === 'string' || typeof node === 'number') {
			return String(node);
		}
		if (Array.isArray(node)) {
			return node.map(extractTextContent).join('');
		}
		if (isValidElement(node)) {
			return extractTextContent(
				(node as ReactElement<{ children?: ReactNode }>).props.children,
			);
		}
		return '';
	}, []);

	const elementTextCache = useMemo(() => {
		if (!hasElements) return new Map();
		const cache = new Map<number, { text: string; words: string[]; lastWordIndex: number }>();
		childArray.forEach((child, idx) => {
			if (isValidElement(child)) {
				const text =
					extractTextContent(
						(child as ReactElement<{ children?: ReactNode }>).props.children,
					) || '';
				const words = text.split(/(\s+)/);

				// Pre-calculate last word index to avoid per-render backward scan
				let lastWordIndex = -1;
				for (let i = words.length - 1; i >= 0; i--) {
					const word = words[i];
					if (word && !/^\s+$/.test(word)) {
						lastWordIndex = i;
						break;
					}
				}

				cache.set(idx, {
					text,
					words,
					lastWordIndex,
				});
			}
		});
		return cache;
	}, [hasElements, childArray, extractTextContent]);

	// Auto-calculate stagger timing from timeline config
	const { actualStaggerDelay, actualElementStagger } = useMemo(() => {
		const configDuration = stageConfig?.duration ?? 1000;

		// Use manual overrides if provided (non-zero)
		if (staggerDelay !== 0 && elementStagger !== 0) {
			return { actualStaggerDelay: staggerDelay, actualElementStagger: elementStagger };
		}

		const availableTime = Math.max(0, configDuration - WORD_ANIMATION_DURATION);

		if (!hasElements) {
			const constrainedStagger = calculateWordOnlyStagger(
				cachedWords,
				availableTime,
				stageId,
				configDuration,
			);
			return {
				actualStaggerDelay: staggerDelay || constrainedStagger,
				actualElementStagger: 0,
			};
		}

		const { elementStagger: calcElementStagger, wordStagger: calcWordStagger } =
			calculateElementAndWordStagger(
				childArray,
				elementTextCache,
				availableTime,
				stageId,
				configDuration,
			);

		return {
			actualStaggerDelay: staggerDelay || calcWordStagger,
			actualElementStagger: elementStagger || calcElementStagger,
		};
	}, [
		stageConfig,
		stageId,
		staggerDelay,
		elementStagger,
		hasElements,
		cachedWords,
		childArray,
		elementTextCache,
	]);

	const wordVariants = {
		hidden: {
			opacity: 0,
			filter: `blur(${blurStrength}px)`,
			y: yOffset,
		},
		visible: {
			opacity: 1,
			filter: 'blur(0px)',
			y: 0,
			transition: {
				duration: 0.6,
				ease: [0.22, 1, 0.36, 1] as const,
			},
		},
	};

	const handleComplete = () => {
		if (stage?.status === 'animating') {
			advanceStage();
			logEvent('TIMELINE', 'REVEAL_ANIMATE', 'COMPLETE', {
				stageId,
				direction: stage.direction,
			});
		}
	};

	const renderWords = (
		text: string,
		keyPrefix: string,
		isLastElement: boolean,
		preSplitWords?: string[],
		cachedLastWordIndex?: number,
	) => {
		const words = preSplitWords || text.split(/(\s+)/);

		// Use pre-cached lastWordIndex if available, otherwise scan backward
		let lastWordIndex = cachedLastWordIndex ?? -1;
		if (cachedLastWordIndex === undefined) {
			for (let i = words.length - 1; i >= 0; i--) {
				const word = words[i];
				if (word && !/^\s+$/.test(word)) {
					lastWordIndex = i;
					break;
				}
			}
		}

		return words.map((word, index) => {
			if (/^\s+$/.test(word)) {
				return (
					<span
						key={`${keyPrefix}-space-${
							// biome-ignore lint/suspicious/noArrayIndexKey: whitespace stable
							index
						}`}
					>
						{word}
					</span>
				);
			}

			const isLastWord = isLastElement && index === lastWordIndex;

			return (
				<motion.span
					key={`${keyPrefix}-word-${
						// biome-ignore lint/suspicious/noArrayIndexKey: stable within text
						index
					}`}
					variants={wordVariants}
					style={{
						display: 'inline-block',
						willChange: 'transform, opacity, filter',
					}}
					{...(isLastWord && { onAnimationComplete: handleComplete })}
				>
					{word}
				</motion.span>
			);
		});
	};

	if (!hasElements) {
		const containerVariants = {
			hidden: {},
			visible: {
				transition: {
					staggerChildren: actualStaggerDelay / 1000,
				},
			},
		};

		return (
			<motion.div
				className={className}
				initial={false}
				animate={variant}
				variants={containerVariants}
			>
				{renderWords(childrenText, 'word', true, cachedWords)}
			</motion.div>
		);
	}

	const topContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: actualElementStagger / 1000,
			},
		},
	};

	const elementContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: actualStaggerDelay / 1000,
			},
		},
	};

	const lastElementIndex = childArray.length - 1;

	return (
		<motion.div
			className={className}
			initial={false}
			animate={variant}
			variants={topContainerVariants}
		>
			{childArray.map((child, elementIndex) => {
				if (!isValidElement(child)) {
					return child;
				}

				const cached = elementTextCache.get(elementIndex);
				const textContent = cached?.text || '';
				const preSplitWords = cached?.words;
				const cachedLastWordIndex = cached?.lastWordIndex;

				const isLastElement = elementIndex === lastElementIndex;

				const animatedWords = (
					<motion.span variants={elementContainerVariants} style={{ display: 'inline' }}>
						{renderWords(
							textContent,
							`element-${elementIndex}`,
							isLastElement,
							preSplitWords,
							cachedLastWordIndex,
						)}
					</motion.span>
				);

				return (
					<motion.span
						key={`element-${
							// biome-ignore lint/suspicious/noArrayIndexKey: stable order
							elementIndex
						}`}
						variants={{ hidden: { opacity: 1 }, visible: { opacity: 1 } }}
						style={{ display: 'block' }}
					>
						{cloneElement(child as ReactElement, {}, animatedWords)}
					</motion.span>
				);
			})}
		</motion.div>
	);
}
