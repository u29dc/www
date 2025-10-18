/**
 * Base Animation Reveal Component
 *
 * ## SUMMARY
 * Dual-mode animation: word-by-word text reveal OR element-by-element stagger.
 * Auto-detects mode from children structure. Optimized for performance with GPU
 * acceleration and accessibility support.
 *
 * ## RESPONSIBILITIES
 * - Auto-detect animation mode (word vs element) from children structure
 * - Split text into animatable word spans while preserving whitespace
 * - Orchestrate nested staggered animation timing (elements → words)
 * - Handle blur, opacity, and transform animations with Motion
 * - Respect prefers-reduced-motion for accessibility
 * - Provide flexible trigger modes (mount/manual)
 *
 * ## KEY FLOWS
 * ### Word Mode (no React elements in children)
 * 1. Component mounts → Text split into word spans (whitespace preserved)
 * 2. Motion variants configured with delay/stagger/duration
 * 3. Animation starts based on trigger mode
 * 4. Each word animates: blur(X) → blur(0), opacity(base) → opacity(1), translateY(X) → translateY(0)
 *
 * ### Element Mode (React elements detected in children)
 * 1. Component mounts → Elements extracted, text within each split into words
 * 2. Top container staggers elements by elementStagger
 * 3. Each element's container staggers its words by staggerDelay
 * 4. Nested animation: element appears → words within reveal sequentially
 * 5. Original element type/props preserved (h2, p, etc.)
 *
 * ### Both Modes
 * 6. GPU acceleration via transform/opacity/filter with will-change
 * 7. Reduced motion: instant reveal without animation
 *
 * @module components/base-animation-reveal
 */

'use client';

import { useReducedMotion } from 'motion/react';
import * as motion from 'motion/react-client';
import type { JSX, ReactElement, ReactNode } from 'react';
import {
	Children,
	cloneElement,
	isValidElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import type { BaseAnimationRevealProps } from '@/lib/types/components';

export function BaseAnimationReveal({
	children,
	delay = 0,
	staggerDelay = 10,
	elementStagger = 0,
	duration = 1.5,
	enableBlur = true,
	blurStrength = 10,
	yOffset = 5,
	baseOpacity = 0,
	className = '',
	textClassName = '',
	trigger = 'mount',
	shouldAnimate = true,
	onFinished,
}: BaseAnimationRevealProps): JSX.Element {
	// Detect animation mode based on children structure
	// Element mode: Children contain React elements (h2, p, div, etc.)
	// Word mode: Children are plain text/numbers
	const childArray = useMemo(() => Children.toArray(children), [children]);
	const hasElements = useMemo(
		() => childArray.some((child) => isValidElement(child)),
		[childArray],
	);

	// Reduced motion detection for accessibility
	const prefersReducedMotion = useReducedMotion();

	// Cache string operations to avoid redundant splits
	const childrenText = useMemo(() => String(children), [children]);

	// Completion tracking: ref ensures callback fires exactly once
	const completedRef = useRef(false);

	// Reset completion tracking when animation parameters change
	// Enables replays and content swaps to trigger callback again
	// biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are intentional for reset behavior
	useEffect(() => {
		completedRef.current = false;
	}, [children, trigger, shouldAnimate]);

	// Cache word splitting for word mode to eliminate redundant regex operations
	const cachedWords = useMemo(() => {
		if (hasElements) return [];
		return childrenText.split(/(\s+)/);
	}, [hasElements, childrenText]);

	const cachedNonWhitespaceWords = useMemo(() => {
		if (hasElements) return [];
		return cachedWords.filter((w) => !/^\s+$/.test(w));
	}, [hasElements, cachedWords]);

	// Helper function to recursively extract text from React nodes
	// Handles nested elements like <em>, <strong>, inline components, etc.
	const extractTextContent = (node: ReactNode): string => {
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
	};

	// Helper function to determine display mode for React elements
	// Preserves inline vs block semantics to prevent layout breaks
	const getDisplayMode = (element: ReactElement): 'inline' | 'block' => {
		const type = element.type;
		if (typeof type === 'string') {
			// Inline elements: span, a, em, strong, code, etc.
			const inlineElements = new Set([
				'a',
				'abbr',
				'b',
				'bdi',
				'bdo',
				'br',
				'cite',
				'code',
				'data',
				'dfn',
				'em',
				'i',
				'kbd',
				'mark',
				'q',
				's',
				'samp',
				'small',
				'span',
				'strong',
				'sub',
				'sup',
				'time',
				'u',
				'var',
				'wbr',
			]);
			return inlineElements.has(type) ? 'inline' : 'block';
		}
		// Default to block for custom components
		return 'block';
	};

	// Cache element text extraction and word splits for element mode
	// extractTextContent is stable so excluded from dependencies
	// biome-ignore lint/correctness/useExhaustiveDependencies: extractTextContent is stable helper
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
					words: text.split(/(\s+)/).filter((w) => !/^\s+$/.test(w)),
				});
			}
		});
		return cache;
	}, [hasElements, childArray]);

	// Calculate total animation duration for safety timeout
	// Formula varies by mode (word vs element)
	const totalDuration = useMemo(() => {
		if (!hasElements) {
			// Word mode: delay + (numWords × staggerDelay) + duration
			return delay + cachedNonWhitespaceWords.length * staggerDelay + duration * 1000;
		}

		// Element mode: delay + (numElements × elementStagger) + (maxWords × staggerDelay) + duration
		const maxWordsInElement = Math.max(
			...Array.from(elementTextCache.values()).map((entry) => entry.words.length),
			1, // Minimum 1 to avoid -Infinity from empty array
		);

		return (
			delay +
			elementTextCache.size * elementStagger +
			maxWordsInElement * staggerDelay +
			duration * 1000
		);
	}, [
		hasElements,
		cachedNonWhitespaceWords,
		elementTextCache,
		delay,
		staggerDelay,
		elementStagger,
		duration,
	]);

	// Callback handler with guard to prevent double-firing
	const handleComplete = useCallback(() => {
		if (completedRef.current || !onFinished) return;
		completedRef.current = true;
		onFinished();
	}, [onFinished]);

	// Reduced motion: Fire callback immediately (animations skip)
	useEffect(() => {
		if (prefersReducedMotion && onFinished) {
			handleComplete();
		}
	}, [prefersReducedMotion, onFinished, handleComplete]);

	// Safety timeout: Fallback if Motion events don't fire
	// Fires 100ms after calculated duration as insurance
	useEffect(() => {
		if (!onFinished || trigger === 'manual' || prefersReducedMotion) return;

		const timer = setTimeout(handleComplete, totalDuration + 100);
		return () => clearTimeout(timer);
	}, [handleComplete, totalDuration, trigger, prefersReducedMotion, onFinished]);

	// Motion variants for word-level animation
	// Conditionally build filter property to satisfy exactOptionalPropertyTypes
	const wordVariants = useMemo(
		() => ({
			hidden: enableBlur
				? {
						opacity: baseOpacity,
						filter: `blur(${blurStrength}px)`,
						y: yOffset,
					}
				: {
						opacity: baseOpacity,
						y: yOffset,
					},
			visible: enableBlur
				? {
						opacity: 1,
						filter: 'blur(0px)',
						y: 0,
						transition: {
							duration,
							ease: [0.22, 1, 0.36, 1] as const,
						},
					}
				: {
						opacity: 1,
						y: 0,
						transition: {
							duration,
							ease: [0.22, 1, 0.36, 1] as const,
						},
					},
		}),
		[enableBlur, baseOpacity, blurStrength, yOffset, duration],
	);

	// Determine animation state based on trigger mode
	const animate = trigger === 'manual' ? (shouldAnimate ? 'visible' : 'hidden') : 'visible';

	// Helper function to split text into word spans
	// isLastElement: if true, attach completion callback to last word
	// preSplitWords: optional pre-split words array to avoid redundant splitting
	const renderWords = (
		text: string,
		keyPrefix: string,
		isLastElement = false,
		preSplitWords?: string[],
	) => {
		const words = preSplitWords || text.split(/(\s+)/);

		// Find index of last non-whitespace word for callback attachment
		let lastWordIndex = -1;
		for (let i = words.length - 1; i >= 0; i--) {
			const word = words[i];
			if (word && !/^\s+$/.test(word)) {
				lastWordIndex = i;
				break;
			}
		}

		return words.map((word, index) => {
			// Preserve whitespace nodes as-is without animation
			if (/^\s+$/.test(word)) {
				return (
					<span
						key={`${keyPrefix}-space-${
							// biome-ignore lint/suspicious/noArrayIndexKey: whitespace nodes stable
							index
						}`}
					>
						{word}
					</span>
				);
			}

			// Determine if this is the last word to animate (for callback attachment)
			const isLastWord = isLastElement && index === lastWordIndex;

			// Wrap non-whitespace words in animated spans
			return (
				<motion.span
					key={`${keyPrefix}-word-${
						// biome-ignore lint/suspicious/noArrayIndexKey: stable index within text
						index
					}`}
					className={textClassName}
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
		// Container variants: stagger words
		const containerVariants = {
			hidden: {},
			visible: {
				transition: {
					staggerChildren: staggerDelay / 1000,
					delayChildren: delay / 1000,
				},
			},
		};

		return (
			<motion.div
				className={className}
				initial="hidden"
				animate={animate}
				variants={containerVariants}
			>
				{renderWords(childrenText, 'word', true, cachedWords)}
			</motion.div>
		);
	}

	// ELEMENT MODE: React element children
	// Top-level container variants: stagger elements
	const topContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: elementStagger / 1000,
				delayChildren: delay / 1000,
			},
		},
	};

	// Element-level container variants: stagger words within each element
	const elementContainerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: staggerDelay / 1000,
			},
		},
	};

	// Find last element index for callback attachment
	const lastElementIndex = childArray.length - 1;

	return (
		<motion.div
			className={className}
			initial="hidden"
			animate={animate}
			variants={topContainerVariants}
		>
			{childArray.map((child, elementIndex) => {
				// Pass through non-element children unchanged
				if (!isValidElement(child)) {
					return child;
				}

				// Get cached text content and pre-split words for this element
				const cached = elementTextCache.get(elementIndex);
				const textContent = cached?.text || '';
				const preSplitWords = cached ? textContent.split(/(\s+)/) : undefined;

				// Determine if this is the last element (for callback attachment)
				const isLastElement = elementIndex === lastElementIndex;

				// Create animated word spans for this element's text
				// Note: No initial/animate props - inherits from parent for stagger timing
				// Last element gets callback attached to its last word
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

				// Clone original element, preserving type and props
				// Replace children with animated word spans
				// Wrapper has minimal variants to participate in animation tree
				return (
					<motion.span
						key={`element-${
							// biome-ignore lint/suspicious/noArrayIndexKey: stable element order
							elementIndex
						}`}
						variants={{ hidden: { opacity: 1 }, visible: { opacity: 1 } }}
						style={{ display: getDisplayMode(child as ReactElement) }}
					>
						{cloneElement(child as ReactElement, {}, animatedWords)}
					</motion.span>
				);
			})}
		</motion.div>
	);
}
