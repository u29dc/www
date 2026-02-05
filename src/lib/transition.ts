/**
 * Page transition timing constants and utilities.
 * Scroll utilities are in src/lib/scroll.ts
 */

// Transition timing constants (in milliseconds)
export const TRANSITION = {
	exitDuration: 400,
	enterDuration: 400,
} as const;

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
