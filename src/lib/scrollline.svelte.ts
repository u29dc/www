/**
 * Shared rune store for CoreScrollLine's viewport Y position.
 * Allows downstream components to read the line's screen coordinate
 * without coupling to the scroll line component directly.
 */

function createScrollLineStore() {
	let screenY = $state(0);
	let blurOpacity = $state(0);

	return {
		/** Line's current Y position in viewport pixels */
		get screenY() {
			return screenY;
		},

		/** Update line position (called by CoreScrollLine each frame) */
		setScreenY(y: number) {
			screenY = y;
		},

		/** Blur opacity for line edge treatment (0-1) */
		get blurOpacity() {
			return blurOpacity;
		},

		/** Whether the scroll line blur is currently visible */
		get blurActive() {
			return blurOpacity > 0;
		},

		/** Set blur opacity with clamping */
		setBlurOpacity(opacity: number) {
			blurOpacity = Math.max(0, Math.min(opacity, 1));
		},

		/** Backwards-compatible toggle for full on/off blur */
		setBlurActive(active: boolean) {
			blurOpacity = active ? 1 : 0;
		},
	};
}

export const scrollLine = createScrollLineStore();
