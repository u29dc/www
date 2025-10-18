'use client';

/**
 * Animated Reveal
 *
 * ## SUMMARY
 * Timeline-coordinated word-by-word reveal with staggered Motion animations.
 *
 * ## RESPONSIBILITIES
 * - Subscribe to timeline stage, split text into words, orchestrate staggered animations
 *
 * @module components/animation/animated-reveal
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
import { logEvent } from '@/lib/logger';
import type { StageState } from '@/lib/timeline';
import { useTimeline } from '@/lib/timeline';

export interface AnimatedRevealProps {
	stageId: string;
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
	elementStagger?: number;
	blurStrength?: number;
	yOffset?: number;
}

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

	const stage = useSyncExternalStore(
		store.subscribe,
		() => store.getState(stageId),
		() => undefined,
	);

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
			advanceStage(stageId);
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
	) => {
		const words = preSplitWords || text.split(/(\s+)/);

		let lastWordIndex = -1;
		for (let i = words.length - 1; i >= 0; i--) {
			const word = words[i];
			if (word && !/^\s+$/.test(word)) {
				lastWordIndex = i;
				break;
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
