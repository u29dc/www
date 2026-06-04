import type Lenis from 'lenis';
import { registerRafTask, type RafTaskHandle } from '../lib/raf';

let lenis: Lenis | undefined;
let lenisRaf: RafTaskHandle | undefined;
let isLoading = false;

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointerQuery = window.matchMedia('(hover: none), (pointer: coarse)');

const shouldUseSmoothScroll = (): boolean => !reduceMotionQuery.matches && !coarsePointerQuery.matches;

const destroySmoothScroll = (): void => {
	lenisRaf?.dispose();
	lenisRaf = undefined;
	lenis?.destroy();
	lenis = undefined;
	document.documentElement.dataset['smoothScroll'] = 'native';
};

const startSmoothScroll = async (): Promise<void> => {
	const shouldEnhance = shouldUseSmoothScroll();
	if (lenis || isLoading || !shouldEnhance) {
		document.documentElement.dataset['smoothScroll'] = lenis && shouldEnhance ? 'enhanced' : 'native';
		return;
	}

	isLoading = true;
	try {
		const { default: LenisConstructor } = await import('lenis');

		if (!shouldUseSmoothScroll()) {
			document.documentElement.dataset['smoothScroll'] = 'native';
			return;
		}

		lenis = new LenisConstructor({
			anchors: true,
			autoRaf: false,
			autoResize: true,
			lerp: 0.12,
			smoothWheel: true,
			syncTouch: false,
			gestureOrientation: 'vertical',
			prevent: (node) => node.hasAttribute('data-native-scroll'),
			virtualScroll: ({ event }) => !(event instanceof WheelEvent && (event.shiftKey || event.ctrlKey || event.metaKey)),
		});
		lenisRaf = registerRafTask((timestamp) => {
			if (!lenis) return false;
			lenis.raf(timestamp);
			return true;
		});
		document.documentElement.dataset['smoothScroll'] = 'enhanced';
	} catch {
		document.documentElement.dataset['smoothScroll'] = 'native';
	} finally {
		isLoading = false;
	}
};

const syncSmoothScroll = (): void => {
	if (shouldUseSmoothScroll()) {
		void startSmoothScroll();
		return;
	}
	destroySmoothScroll();
};

void startSmoothScroll();
reduceMotionQuery.addEventListener('change', syncSmoothScroll);
coarsePointerQuery.addEventListener('change', syncSmoothScroll);

document.addEventListener('astro:page-load', syncSmoothScroll);
