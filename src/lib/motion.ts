/**
 * Motion constants for animations and interactive effects.
 */

/** Parallax movement factors (1.0 = same speed as scroll) */
export const PARALLAX = {
	/** Hero image moves at half scroll speed */
	hero: 0.5,
	/** Hero content parallax (0.5 * 0.3 = 0.15) */
	heroContent: 0.15,
} as const;

/** Scroll thresholds as viewport height multipliers */
export const SCROLL = {
	/** Hero fade-out range */
	heroFadeRange: 0.5,
	/** CoreScrollLine visibility threshold */
	lineVisibleThreshold: 0.3,
	/** CoreScrollLine scroll start */
	lineScrollStart: 0.5,
} as const;

/** Magnetic cursor effect parameters */
export const MAGNETIC = {
	/** CoreScrollLine magnet radius (px) */
	lineRadius: 150,
	/** CoreScrollLine X range (px) */
	lineXRange: 50,
	/** CoreScrollLine Y range (px) */
	lineYRange: 20,
	/** Origin photo magnet radius (px) */
	originRadius: 800,
	/** Origin photo max offset (px) */
	originMaxOffset: 10,
} as const;
