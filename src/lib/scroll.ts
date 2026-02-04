import type Lenis from 'lenis';

let instance: Lenis | null = null;

export const setLenisInstance = (lenis: Lenis | null) => {
	instance = lenis;
};

/**
 * Returns the target scroll position (where scroll is heading).
 * When Lenis is active, returns targetScroll to avoid double-smoothing.
 * Falls back to window.scrollY when Lenis is inactive.
 */
export const getScrollY = () => {
	return instance?.targetScroll ?? window.scrollY;
};

/**
 * Returns the current interpolated scroll position.
 * Useful when you need the actual visual position, not the target.
 */
export const getInterpolatedScrollY = () => {
	return instance?.scroll ?? window.scrollY;
};
