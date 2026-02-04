/**
 * Page transition timing constants and utilities.
 * Coordinates with Lenis smooth scroll for seamless navigation experiences.
 */

import type Lenis from 'lenis';

// Transition timing constants (in milliseconds)
export const TRANSITION = {
	exitDuration: 650,
	enterDuration: 650,
} as const;

// Reference to Lenis instance (set by CoreSmoothScroll)
let lenisInstance: Lenis | null = null;

/**
 * Set the Lenis instance for scroll reset coordination.
 * Called by CoreSmoothScroll on mount/unmount.
 */
export const setTransitionLenis = (lenis: Lenis | null) => {
	lenisInstance = lenis;
};

/**
 * Reset scroll position to top.
 * Uses Lenis scrollTo when available for smooth coordination,
 * falls back to native window.scrollTo otherwise.
 */
export const resetScroll = () => {
	if (lenisInstance) {
		lenisInstance.scrollTo(0, { immediate: true });
	} else {
		window.scrollTo(0, 0);
	}
};

/**
 * Factory for creating scroll-reveal intersection observers.
 * Returns a function that observes elements and calls onReveal when they enter viewport.
 *
 * @param options - IntersectionObserver options (threshold, rootMargin)
 * @returns Setup function that takes elements and callback, returns cleanup function
 */
export const createScrollReveal = (options: { threshold?: number; rootMargin?: string } = {}) => {
	const { threshold = 0.1, rootMargin = '-30px' } = options;

	return (elements: Element[], onReveal: (element: Element, index: number) => void): (() => void) => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = elements.indexOf(entry.target);
						if (index !== -1) {
							onReveal(entry.target, index);
						}
					}
				}
			},
			{ threshold, rootMargin },
		);

		for (const element of elements) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	};
};
