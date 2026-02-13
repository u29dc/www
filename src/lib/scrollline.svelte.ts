/**
 * Shared rune store for CoreScrollLine's viewport Y position.
 * Allows downstream components to read the line's screen coordinate
 * without coupling to the scroll line component directly.
 */

function createScrollLineStore() {
	let screenY = $state(0);

	return {
		/** Line's current Y position in viewport pixels */
		get screenY() {
			return screenY;
		},

		/** Update line position (called by CoreScrollLine each frame) */
		setScreenY(y: number) {
			screenY = y;
		},
	};
}

export const scrollLine = createScrollLineStore();
