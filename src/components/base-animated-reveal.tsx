'use client';

/**
 * Animated Reveal (Timeline-Aware)
 *
 * ## SUMMARY
 * Timeline-coordinated word-by-word reveal animation component.
 * Extends AnimatedSection pattern with word-splitting logic.
 *
 * ## RESPONSIBILITIES
 * - Connect to timeline store for reactive stage state
 * - Split text into animatable word spans
 * - Orchestrate staggered word animations via Motion
 * - Notify timeline orchestrator on completion
 * - Support both single text and multiple element children
 *
 * ## USAGE
 * ```tsx
 * import { AnimatedReveal } from '@/components/base-animated-reveal';
 *
 * <TimelineProvider config={homeTimeline}>
 *   <AnimatedReveal stageId="hero-text" staggerDelay={10}>
 *     <h2>This text will split into words</h2>
 *     <p>Each element animates with word reveals</p>
 *   </AnimatedReveal>
 * </TimelineProvider>
 * ```
 *
 * @module components/base-animated-reveal
 */

import { motion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import {
	Children,
	cloneElement,
	isValidElement,
	useCallback,
	useMemo,
	useSyncExternalStore,
} from 'react';
import type { StageState } from '@/lib/animation/timeline';
import { useTimeline } from '@/lib/animation/timeline';
import { logEvent } from '@/lib/utils/logger';

export interface AnimatedRevealProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
	elementStagger?: number;
	blurStrength?: number;
	yOffset?: number;
}

/**
 * AnimatedReveal component
 *
 * Timeline-coordinated word-by-word reveal with stagger animations.
 * Splits text into words and animates each sequentially.
 */
export function AnimatedReveal({
	stageId,
	children,
	className,
	staggerDelay = 10,
	elementStagger = 200,
	blurStrength = 10,
	yOffset = 5,
}: AnimatedRevealProps) {
	const { store, advanceStage } = useTimeline();

	// Subscribe to stage state changes
	const stage = useSyncExternalStore(
		store.subscribe,
		() => store.getState(stageId),
		() => undefined,
	);

	// Detect if children contain React elements
	const childArray = useMemo(() => Children.toArray(children), [children]);
	const hasElements = useMemo(
		() => childArray.some((child) => isValidElement(child)),
		[childArray],
	);

	// Cache plain text for word mode
	const childrenText = useMemo(() => String(children), [children]);
	const cachedWords = useMemo(() => {
		if (hasElements) return [];
		return childrenText.split(/(\s+)/);
	}, [hasElements, childrenText]);

	// Helper to extract text from React nodes
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

	// Cache element text extraction for element mode
	const elementTextCache = useMemo(() => {
		if (!hasElements) return new Map();
		const cache = new Map<number, { text: string; words: string[] }>();
		childArray.forEach((child, idx) => {
			if (isValidElement(child)) {
				const text =
					extractTextContent(
						(child as ReactElement<{ children?: ReactNode }>).props.children,
					) || '';
				cache.set(idx, {
					text,
					words: text.split(/(\s+)/),
				});
			}
		});
		return cache;
	}, [hasElements, childArray, extractTextContent]);

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

	// Word-level animation variants
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

	// Completion handler
	const handleComplete = () => {
		if (stage?.status === 'animating') {
			advanceStage(stageId);
			logEvent('TIMELINE', 'REVEAL_ANIMATE', 'COMPLETE', {
				stageId,
				direction: stage.direction,
			});
		}
	};

	// Helper function to render words as Motion spans
	const renderWords = (
		text: string,
		keyPrefix: string,
		isLastElement: boolean,
		preSplitWords?: string[],
	) => {
		const words = preSplitWords || text.split(/(\s+)/);

		// Find last non-whitespace word for callback
		let lastWordIndex = -1;
		for (let i = words.length - 1; i >= 0; i--) {
			const word = words[i];
			if (word && !/^\s+$/.test(word)) {
				lastWordIndex = i;
				break;
			}
		}

		return words.map((word, index) => {
			// Preserve whitespace
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

	// WORD MODE: Simple text children
	if (!hasElements) {
		const containerVariants = {
			hidden: {},
			visible: {
				transition: {
					staggerChildren: staggerDelay / 1000,
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

	// ELEMENT MODE: React element children
	const topContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: elementStagger / 1000,
			},
		},
	};

	const elementContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: staggerDelay / 1000,
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

				const isLastElement = elementIndex === lastElementIndex;

				const animatedWords = (
					<motion.span variants={elementContainerVariants} style={{ display: 'inline' }}>
						{renderWords(
							textContent,
							`element-${elementIndex}`,
							isLastElement,
							preSplitWords,
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
