import type { ActionReturn } from 'svelte/action';

export interface ObserveVisibilityOptions {
	/** Called when element enters viewport */
	onEnter?: () => void;
	/** Called when element leaves viewport */
	onLeave?: () => void;
	/** Disconnect after first intersection (default: true) */
	once?: boolean;
	/** IntersectionObserver rootMargin (default: '200px') */
	rootMargin?: string;
	/** IntersectionObserver threshold (default: 0) */
	threshold?: number;
	/** Skip observation entirely, immediately call onEnter (default: false) */
	disabled?: boolean;
}

/**
 * Svelte action for visibility-based behavior using IntersectionObserver.
 *
 * Each component gets its own observer instance, which is fine for performance
 * (browser optimizes multiple observers) and provides cleaner cleanup semantics
 * tied to component lifecycle.
 *
 * @example Basic usage
 * ```svelte
 * <div use:observeVisibility={{
 *     onEnter: () => { isVisible = true; },
 *     onLeave: () => { isVisible = false; },
 *     once: false
 * }} />
 * ```
 *
 * @example Conditional observation
 * ```svelte
 * <div use:observeVisibility={{
 *     onEnter: () => { isVisible = true; },
 *     disabled: !animated
 * }} />
 * ```
 */
export function observeVisibility(node: HTMLElement, options: ObserveVisibilityOptions = {}): ActionReturn<ObserveVisibilityOptions> {
	let currentOptions = options;
	let observer: IntersectionObserver | null = null;
	let hasTriggeredOnce = false;

	const setupObserver = () => {
		const { onEnter, onLeave, once = true, rootMargin = '200px', threshold = 0, disabled = false } = currentOptions;

		// Cleanup existing observer
		observer?.disconnect();
		observer = null;

		// Skip observation if disabled or IntersectionObserver unavailable
		if (disabled || typeof IntersectionObserver === 'undefined') {
			onEnter?.();
			hasTriggeredOnce = true;
			return;
		}

		// Skip if already triggered once and once=true
		if (once && hasTriggeredOnce) {
			return;
		}

		observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					onEnter?.();
					if (once) {
						hasTriggeredOnce = true;
						observer?.disconnect();
						observer = null;
					}
				} else {
					onLeave?.();
				}
			},
			{ rootMargin, threshold },
		);

		observer.observe(node);
	};

	setupObserver();

	return {
		update(newOptions: ObserveVisibilityOptions) {
			currentOptions = newOptions;
			setupObserver();
		},
		destroy() {
			observer?.disconnect();
		},
	};
}

export interface ActiveTrackerOptions {
	/** IntersectionObserver rootMargin (default: '-100px 0px -50% 0px') */
	rootMargin?: string;
	/** IntersectionObserver threshold (default: 0.3) */
	threshold?: number;
}

/**
 * Tracks which section element is currently active in the viewport.
 * Used for navigation highlighting.
 *
 * @example
 * ```typescript
 * const tracker = createActiveTracker(
 *     ['section1', 'section2', 'section3'],
 *     (activeId) => { currentSection = activeId; }
 * );
 * onDestroy(() => tracker.disconnect());
 * ```
 */
export function createActiveTracker(elementIds: string[], onActiveChange: (activeId: string | null) => void, options: ActiveTrackerOptions = {}): { disconnect: () => void } {
	const { rootMargin = '-20% 0px -50% 0px', threshold = 0 } = options;

	if (typeof IntersectionObserver === 'undefined') {
		return { disconnect: () => {} };
	}

	const elements = elementIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);

	if (elements.length === 0) {
		return { disconnect: () => {} };
	}

	// Track which sections are currently intersecting
	const visibleSections = new Set<string>();

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					visibleSections.add(entry.target.id);
				} else {
					visibleSections.delete(entry.target.id);
				}
			}

			// If nothing visible, clear active
			if (visibleSections.size === 0) {
				onActiveChange(null);
				return;
			}

			// Pick the first visible section in document order
			for (const id of elementIds) {
				if (visibleSections.has(id)) {
					onActiveChange(id);
					return;
				}
			}
		},
		{ threshold, rootMargin },
	);

	for (const el of elements) {
		observer.observe(el);
	}

	return { disconnect: () => observer.disconnect() };
}

export interface StaggerObserverOptions {
	/** IntersectionObserver rootMargin (default: '-30px') */
	rootMargin?: string;
	/** IntersectionObserver threshold (default: 0.1) */
	threshold?: number;
}

/**
 * Observes multiple elements and calls back when each becomes visible.
 * Used for staggered reveal animations.
 *
 * @example
 * ```typescript
 * const stagger = createStaggerObserver(
 *     itemElements,
 *     (index) => { visibleItems.add(index); }
 * );
 * onDestroy(() => stagger.disconnect());
 * ```
 */
export function createStaggerObserver(elements: HTMLElement[], onBecomeVisible: (index: number) => void, options: StaggerObserverOptions = {}): { disconnect: () => void } {
	const { rootMargin = '-30px', threshold = 0.1 } = options;

	if (typeof IntersectionObserver === 'undefined') {
		// No observer support - reveal all immediately
		for (let i = 0; i < elements.length; i++) {
			onBecomeVisible(i);
		}
		return { disconnect: () => {} };
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const index = elements.indexOf(entry.target as HTMLElement);
					if (index !== -1) {
						onBecomeVisible(index);
					}
				}
			}
		},
		{ threshold, rootMargin },
	);

	for (const el of elements) {
		if (el) observer.observe(el);
	}

	return { disconnect: () => observer.disconnect() };
}
