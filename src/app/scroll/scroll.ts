import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../device/device';
import { onRouteAfterSwap, onRouteLoad } from '../route/route';
import { createTask } from '../runtime/task';
import { createAnimator } from './animate';
import { clamp } from './math';
import { normalizeWheelDeltaY, shouldUseNativeWheel } from './virtual';

type ScrollSource = 'wheel' | 'anchor' | 'route' | 'native';
type ScrollDirection = -1 | 0 | 1;

type ScrollState = {
	initialized: boolean;
	enabled: boolean;
	active: boolean;
	source: ScrollSource;
	actual: number;
	animated: number;
	target: number;
	velocity: number;
	direction: ScrollDirection;
	limit: number;
	programmatic: boolean;
	writeY: number | undefined;
	wake: (reason?: string) => void;
	sleep: () => void;
	cleanups: Array<() => void>;
};

const ENABLE_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SCROLL_LERP = 0.1;
const SETTLE_PX = 0.5;

const enableQuery = window.matchMedia(ENABLE_QUERY);
const reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
const animator = createAnimator({ lerp: SCROLL_LERP, settlePx: SETTLE_PX });
const state: ScrollState = {
	initialized: false,
	enabled: false,
	active: false,
	source: 'native',
	actual: 0,
	animated: 0,
	target: 0,
	velocity: 0,
	direction: 0,
	limit: 0,
	programmatic: false,
	writeY: undefined,
	wake: () => {},
	sleep: () => {},
	cleanups: [],
};

export const scroll = createTask({
	name: 'scroll',
	order: 30,
	state,
	preinit(context) {
		state.wake = context.wake;
		state.sleep = context.sleep;
		bindScroll();
	},
	init() {
		syncFromWindow('route');
		applyCapability();
	},
	resize() {
		measureLimit();
		clampModelToLimit();
	},
	update(frame) {
		if (!state.active || !frame.visible) {
			state.sleep();
			return;
		}

		animator.retarget(state.target);
		const done = animator.advance(frame.dt);
		state.animated = animator.value;
		state.velocity = animator.velocity;
		state.direction = Math.sign(state.velocity) as ScrollDirection;
		state.writeY = state.animated;

		if (done) {
			state.active = false;
			state.source = 'native';
		}
	},
	write() {
		if (state.writeY === undefined) return;

		const y = state.writeY;
		state.writeY = undefined;
		state.actual = y;
		if (Math.abs(window.scrollY - y) <= 0.1) return;

		state.programmatic = true;
		window.scrollTo(0, y);
	},
	post() {
		if (state.active) return;
		state.programmatic = false;
		state.source = 'native';
		state.sleep();
	},
	dispose() {
		for (const cleanup of state.cleanups.splice(0)) cleanup();
		syncFromWindow('native');
	},
});

const readLimit = (): number => {
	const body = document.body;
	const root = document.documentElement;
	return Math.max(0, Math.max(body.scrollHeight, root.scrollHeight) - window.innerHeight);
};

const measureLimit = (): void => {
	state.limit = readLimit();
};

const clampModelToLimit = (): void => {
	state.actual = clamp(state.actual, 0, state.limit);
	state.animated = clamp(state.animated, 0, state.limit);
	state.target = clamp(state.target, 0, state.limit);
	animator.start(state.animated, state.target);
	if (state.animated === state.target) {
		animator.stop();
	}
};

const syncFromWindow = (source: ScrollSource): void => {
	measureLimit();
	const y = clamp(window.scrollY, 0, state.limit);
	state.actual = y;
	state.animated = y;
	state.target = y;
	state.velocity = 0;
	state.direction = 0;
	state.source = source;
	state.active = false;
	state.writeY = undefined;
	state.programmatic = false;
	animator.sync(y);
	state.sleep();
};

const shouldEnhance = (): boolean => {
	const profile = getDeviceProfile();
	return (
		enableQuery.matches &&
		!reduceMotionQuery.matches &&
		profile.motionQuality !== 'reduced' &&
		profile.inputProfile !== 'coarse' &&
		profile.displayProfile !== 'small' &&
		profile.networkProfile !== 'save-data' &&
		profile.tier !== 'low'
	);
};

const applyCapability = (): void => {
	state.enabled = shouldEnhance();
	document.documentElement.dataset['smoothScroll'] = state.enabled ? 'enhanced' : 'native';
	if (!state.enabled) syncFromWindow('native');
};

const startWheelScroll = (deltaY: number): void => {
	measureLimit();
	if (!state.active) {
		const y = clamp(window.scrollY, 0, state.limit);
		state.actual = y;
		state.animated = y;
		state.target = y;
		animator.sync(y);
	}

	state.target = clamp(state.target + deltaY, 0, state.limit);
	state.source = 'wheel';
	state.active = true;
	animator.retarget(state.target);
	state.wake('scroll:wheel');
};

const handleWheel = (event: WheelEvent): void => {
	if (shouldUseNativeWheel(event, state.enabled)) return;

	event.preventDefault();
	startWheelScroll(normalizeWheelDeltaY(event));
};

const handleNativeScroll = (): void => {
	if (state.programmatic) {
		if (Math.abs(window.scrollY - state.animated) > 2) {
			state.programmatic = false;
			syncFromWindow('native');
			return;
		}
		state.programmatic = false;
		return;
	}
	syncFromWindow('native');
};

const handleInterrupt = (): void => {
	if (!state.active) return;
	syncFromWindow('native');
};

const handleRouteSync = (): void => {
	syncFromWindow('route');
	applyCapability();
};

const addCleanup = (cleanup: () => void): void => {
	state.cleanups.push(cleanup);
};

const bindScroll = (): void => {
	if (state.initialized) return;
	state.initialized = true;

	initDeviceProfile();
	window.addEventListener('wheel', handleWheel, { passive: false });
	addCleanup(() => window.removeEventListener('wheel', handleWheel));
	window.addEventListener('scroll', handleNativeScroll, { passive: true });
	addCleanup(() => window.removeEventListener('scroll', handleNativeScroll));
	window.addEventListener('keydown', handleInterrupt, { passive: true });
	addCleanup(() => window.removeEventListener('keydown', handleInterrupt));
	window.addEventListener('pointerdown', handleInterrupt, { passive: true });
	addCleanup(() => window.removeEventListener('pointerdown', handleInterrupt));
	enableQuery.addEventListener('change', applyCapability);
	addCleanup(() => enableQuery.removeEventListener('change', applyCapability));
	reduceMotionQuery.addEventListener('change', applyCapability);
	addCleanup(() => reduceMotionQuery.removeEventListener('change', applyCapability));
	addCleanup(subscribeDeviceProfile(applyCapability));
	addCleanup(onRouteAfterSwap(handleRouteSync));
	addCleanup(onRouteLoad(handleRouteSync));
	applyCapability();
};

export const getScrollState = (): {
	actual: number;
	animated: number;
	target: number;
	velocity: number;
	direction: ScrollDirection;
	limit: number;
	active: boolean;
	source: ScrollSource;
	enabled: boolean;
} => ({
	actual: state.actual,
	animated: state.animated,
	target: state.target,
	velocity: state.velocity,
	direction: state.direction,
	limit: state.limit,
	active: state.active,
	source: state.source,
	enabled: state.enabled,
});
