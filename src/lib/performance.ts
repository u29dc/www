import { useSyncExternalStore } from 'react';

/**
 * Device performance tier classification.
 *
 * - `low`: ≤2GB RAM, ≤2 CPU cores, or prefers-reduced-motion
 * - `medium`: ≤4GB RAM or ≤4 CPU cores
 * - `high`: >4GB RAM and >4 CPU cores with motion enabled
 */
export type DeviceTier = 'high' | 'medium' | 'low';

// Conservative SSR fallback to keep markup stable until hydration resolves tier
const SERVER_DEFAULT_DEVICE_TIER: DeviceTier = 'low';

// Module-level cache (NOT sessionStorage - avoids SSR issues)
let cachedTier: DeviceTier | null = null;

// Module-level motion preference listener (prevents memory leaks)
let motionMediaQuery: MediaQueryList | null = null;
let motionListener: ((e: MediaQueryListEvent) => void) | null = null;
let isInitializingMotionListener = false;

// Version counter for reactive tier updates (tracked but not read - event-based subscription used instead)
let _tierVersion = 0;

// Custom event name for tier changes
const TIER_CHANGE_EVENT = 'devicetierchange';

// Hydration-safe tier store backing useDeviceTier
const tierStoreListeners = new Set<() => void>();
let tierStoreValue: DeviceTier = SERVER_DEFAULT_DEVICE_TIER;
let hasInitializedClientTierDetection = false;

const notifyTierStoreSubscribers = () => {
	for (const listener of tierStoreListeners) {
		listener();
	}
};

const setTierStoreValue = (nextTier: DeviceTier) => {
	if (tierStoreValue === nextTier) return;
	tierStoreValue = nextTier;
	notifyTierStoreSubscribers();
};

const handleTierChange = () => {
	setTierStoreValue(detectDeviceTier());
};

const initClientTierDetection = () => {
	if (hasInitializedClientTierDetection || typeof window === 'undefined') {
		return;
	}
	hasInitializedClientTierDetection = true;

	// Resolve actual tier as soon as we're safely on the client
	handleTierChange();
	window.addEventListener(TIER_CHANGE_EVENT, handleTierChange);
};

const teardownClientTierDetection = () => {
	if (!hasInitializedClientTierDetection || typeof window === 'undefined') {
		return;
	}
	window.removeEventListener(TIER_CHANGE_EVENT, handleTierChange);
	hasInitializedClientTierDetection = false;
};

/**
 * Detects the current device's performance tier based on hardware capabilities
 * and user motion preferences.
 *
 * Uses module-level memoization - subsequent calls return cached value.
 * Cache automatically refreshes when motion preferences change.
 *
 * Safe to call from both server and client contexts - defaults to 'high' tier
 * during server-side rendering.
 *
 * @returns Device performance tier classification
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * function MyComponent() {
 *   const tier = detectDeviceTier();
 *   const enableExpensiveEffect = tier === 'high';
 *   // ...
 * }
 * ```
 */
export function detectDeviceTier(): DeviceTier {
	// Return cached value if available
	if (cachedTier !== null) return cachedTier;

	// SSR guard: default to 'high' tier during server-side rendering
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		cachedTier = 'high';
		return cachedTier;
	}

	// Client-side detection logic
	const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
	const cores = navigator.hardwareConcurrency ?? 4;

	// Cache MediaQueryList synchronously so later callers can read current value
	if (!motionMediaQuery) {
		motionMediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
	}
	const reducedMotion = motionMediaQuery.matches;

	// Tier determination
	if (reducedMotion || memory <= 2 || cores <= 2) {
		cachedTier = 'low';
	} else if (memory <= 4 || cores <= 4) {
		cachedTier = 'medium';
	} else {
		cachedTier = 'high';
	}

	// Set up motion preference listener (only once) to allow cache refresh
	if (
		typeof requestIdleCallback !== 'undefined' &&
		!motionListener &&
		!isInitializingMotionListener
	) {
		isInitializingMotionListener = true;
		requestIdleCallback(() => {
			try {
				motionListener = () => {
					cachedTier = null; // Invalidate cache when preference changes
					_tierVersion++; // Increment version for reactive updates
					// Dispatch custom event for useDeviceTier hook subscribers
					if (typeof window !== 'undefined') {
						window.dispatchEvent(new Event(TIER_CHANGE_EVENT));
					}
				};
				motionMediaQuery?.addEventListener('change', motionListener);
			} finally {
				isInitializingMotionListener = false;
			}
		});
	}

	return cachedTier;
}

/**
 * Resets the cached device tier, forcing re-detection on next call.
 * Also cleans up any active motion preference listeners to prevent memory leaks.
 * Primarily for testing purposes.
 *
 * @example
 * ```typescript
 * resetDeviceTierCache();
 * const newTier = detectDeviceTier(); // Fresh detection
 * ```
 */
export function resetDeviceTierCache(): void {
	cachedTier = null;

	// Clean up motion preference listener
	if (motionMediaQuery && motionListener) {
		motionMediaQuery.removeEventListener('change', motionListener);
		motionListener = null;
		motionMediaQuery = null;
	}

	// Reset initialization flag
	isInitializingMotionListener = false;

	setTierStoreValue(SERVER_DEFAULT_DEVICE_TIER);
	if (typeof window !== 'undefined' && hasInitializedClientTierDetection) {
		handleTierChange();
	}
}

const subscribeToTierStore = (callback: () => void) => {
	tierStoreListeners.add(callback);
	if (typeof window !== 'undefined') {
		initClientTierDetection();
	}
	return () => {
		tierStoreListeners.delete(callback);
		if (tierStoreListeners.size === 0) {
			teardownClientTierDetection();
			tierStoreValue = SERVER_DEFAULT_DEVICE_TIER;
		}
	};
};

const getTierSnapshot = () => tierStoreValue;
const getServerTierSnapshot = () => SERVER_DEFAULT_DEVICE_TIER;

/**
 * React hook for reactive device tier detection.
 *
 * Unlike `detectDeviceTier()`, this hook automatically updates when the user's
 * motion preferences change, triggering a re-render with the new tier.
 *
 * Hydration-safe: SSR and the first client render share the same
 * conservative `'low'` tier, then a client-side store promotes the tier
 * after hydration and keeps it up to date via `useSyncExternalStore`
 * subscriptions to `TIER_CHANGE_EVENT` broadcasts.
 *
 * @returns Current device performance tier (updates reactively)
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * function AnimatedComponent() {
 *   const tier = useDeviceTier();
 *   const shouldAnimate = tier !== 'low';
 *
 *   return shouldAnimate ? <AnimatedBlock /> : <StaticBlock />;
 * }
 * ```
 */
export function useDeviceTier(): DeviceTier {
	return useSyncExternalStore(subscribeToTierStore, getTierSnapshot, getServerTierSnapshot);
}
