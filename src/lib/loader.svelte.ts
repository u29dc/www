/**
 * Loader state store using Svelte 5 runes.
 * Tracks whether the initial page loader is active and provides
 * a completion callback for downstream animation orchestration.
 */

type LoaderCallback = () => void;

function createLoaderStore() {
	let isActive = $state(true);
	let hasCompleted = $state(false);
	let progress = $state(0);
	const callbacks: LoaderCallback[] = [];

	return {
		/** Whether the loader overlay is currently visible */
		get isActive() {
			return isActive;
		},

		/** Whether the initial load sequence has completed (persists across navigations) */
		get hasCompleted() {
			return hasCompleted;
		},

		/** Animation progress from 0 to 1 */
		get progress() {
			return progress;
		},

		/** Set animation progress (0-1) */
		setProgress(value: number) {
			progress = Math.max(0, Math.min(1, value));
		},

		/**
		 * Mark loader as complete. Triggers fade-out and fires all registered callbacks.
		 * Safe to call multiple times (idempotent).
		 */
		complete() {
			if (hasCompleted) return;
			isActive = false;
			hasCompleted = true;
			for (const callback of callbacks) {
				callback();
			}
			callbacks.length = 0;
		},

		/**
		 * Register a callback to fire when loading completes.
		 * If already complete, fires immediately.
		 */
		onComplete(callback: LoaderCallback) {
			if (hasCompleted) {
				callback();
			} else {
				callbacks.push(callback);
			}
		},
	};
}

export const loader = createLoaderStore();
