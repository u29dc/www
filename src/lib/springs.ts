/**
 * Centralized spring physics configuration and simulation.
 *
 * Spring presets are organized by usage domain:
 * - SPRING_UI: Interactive UI elements (scroll indicators, magnetic effects)
 * - SPRING_PARALLAX: Heavy, weighted motion for visual effects
 */

export type SpringConfig = {
	readonly stiffness: number;
	readonly damping: number;
};

export type SpringState = {
	value: number;
	velocity: number;
};

/** UI spring presets for interactive elements */
export const SPRING_UI = {
	/** Scroll progress indicator - responsive, snappy */
	line: { stiffness: 100, damping: 30 } as const satisfies SpringConfig,
	/** Base position follow - softer, more gradual */
	base: { stiffness: 60, damping: 30 } as const satisfies SpringConfig,
	/** Magnetic cursor attraction - quick response, lower damping for bounce */
	magnet: { stiffness: 80, damping: 18 } as const satisfies SpringConfig,
} as const;

/** Parallax spring presets for visual motion effects */
export const SPRING_PARALLAX = {
	/** Heavy photo parallax - slow, weighted, graceful */
	heavy: { stiffness: 25, damping: 12 } as const satisfies SpringConfig,
} as const;

/**
 * Simulate one step of spring physics.
 *
 * Uses a simple Euler integration of Hooke's law with damping:
 * - Force = (target - current) * stiffness
 * - Acceleration = force - velocity * damping
 *
 * @param current - Mutable spring state (value and velocity)
 * @param target - Target value to spring toward
 * @param config - Spring configuration (stiffness, damping)
 * @param delta - Time delta in seconds (clamped internally for stability)
 */
export const spring = (current: SpringState, target: number, config: SpringConfig, delta: number): void => {
	const force = (target - current.value) * config.stiffness;
	const accel = force - current.velocity * config.damping;
	current.velocity += accel * delta;
	current.value += current.velocity * delta;
};
