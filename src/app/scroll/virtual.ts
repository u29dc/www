const LINE_HEIGHT = 100 / 6;
const PAGE_RATIO = 0.9;
const NATIVE_SCROLL_SELECTOR = '[data-native-scroll], [data-scroll-native], textarea, select, iframe';

export const normalizeWheelDeltaY = (event: WheelEvent): number => {
	if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_HEIGHT;
	if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight * PAGE_RATIO;
	return event.deltaY;
};

export const shouldUseNativeWheel = (event: WheelEvent, enabled: boolean): boolean => {
	if (!enabled || event.defaultPrevented) return true;
	if (event.ctrlKey || event.metaKey || event.shiftKey) return true;
	if (!(event.target instanceof Element)) return false;
	return Boolean(event.target.closest(NATIVE_SCROLL_SELECTOR));
};
