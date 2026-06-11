import { onRouteAfterSwap, onRouteLoad } from '../route/route';
import { createTask } from '../runtime/task';
import { setTimer, type TimerHandle } from '../runtime/timer';

export type PerformanceTier = 'low' | 'medium' | 'high';
export type MotionQuality = 'reduced' | 'no-blur' | 'full';
export type InputProfile = 'coarse' | 'fine' | 'mixed' | 'unknown';
export type NetworkProfile = 'save-data' | 'slow' | 'normal' | 'unknown';
export type DisplayProfile = 'small' | 'standard' | 'large';
export type DeviceProfileSource = 'ssr' | 'boot' | 'static-signals' | 'calibrated' | 'fallback';
export type DeviceProfileConfidence = 'low' | 'medium' | 'high';
export type LineDeviceProfile = 'lite' | 'full';

export type DeviceProfile = {
	version: 1;
	source: DeviceProfileSource;
	confidence: DeviceProfileConfidence;
	generation: number;
	updatedAt: number;
	tier: PerformanceTier;
	motionQuality: MotionQuality;
	inputProfile: InputProfile;
	networkProfile: NetworkProfile;
	displayProfile: DisplayProfile;
	dprCap: number;
	lineProfile: LineDeviceProfile;
	allowWebglMotion: boolean;
	allowWebglHighDpr: boolean;
	allowHoverVideo: boolean;
	allowPixelReveal: boolean;
	allowContentVisibility: boolean;
	reasons: string[];
	signals: {
		clientReady: boolean;
		reducedMotion: boolean;
		coarsePointer: boolean;
		finePointer: boolean;
		hover: boolean;
		hardwareConcurrency?: number;
		deviceMemory?: number;
		devicePixelRatio: number;
		saveData?: boolean;
		effectiveType?: string;
		viewportWidth: number;
		viewportHeight: number;
		rafFps?: number;
		longTaskCount?: number;
	};
};

type DeviceProfileOptions = {
	calibrate?: boolean;
};

type DeviceSubscriber = (profile: DeviceProfile) => void;

type NavigatorWithSignals = Navigator & {
	connection?: NetworkInformationLike;
	deviceMemory?: number;
};

type NetworkInformationLike = EventTarget & {
	effectiveType?: string;
	saveData?: boolean;
};

type WindowWithIdle = Window & {
	requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
	cancelIdleCallback?: (handle: number) => void;
};

export const DEVICE_THRESHOLDS = {
	lowCores: 2,
	mediumCores: 4,
	lowMemoryGb: 2,
	mediumMemoryGb: 4,
	highDprMobile: 2.5,
	lowRafFps: 45,
	mediumRafFps: 52,
	resizeRecomputeMs: 180,
	dprBucketStep: 0.25,
	smallViewportWidth: 640,
	largeViewportWidth: 1440,
	calibrationFrames: 18,
	calibrationDelayMs: 1200,
	longTaskMediumCount: 3,
	longTaskLowCount: 8,
} as const;

const DEFAULT_DPR = 1;
const DEFAULT_VIEWPORT_WIDTH = 1024;
const DEFAULT_VIEWPORT_HEIGHT = 768;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof document !== 'undefined';

const safeNow = (): number => (isBrowser() ? performance.now() : 0);

const createDefaultProfile = (): DeviceProfile => ({
	version: 1,
	source: 'ssr',
	confidence: 'low',
	generation: 0,
	updatedAt: safeNow(),
	tier: 'medium',
	motionQuality: 'full',
	inputProfile: 'unknown',
	networkProfile: 'unknown',
	displayProfile: 'standard',
	dprCap: 1.5,
	lineProfile: 'full',
	allowWebglMotion: true,
	allowWebglHighDpr: false,
	allowHoverVideo: false,
	allowPixelReveal: true,
	allowContentVisibility: false,
	reasons: ['ssr:neutral-default'],
	signals: {
		clientReady: false,
		reducedMotion: false,
		coarsePointer: false,
		finePointer: false,
		hover: false,
		devicePixelRatio: DEFAULT_DPR,
		viewportWidth: DEFAULT_VIEWPORT_WIDTH,
		viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
	},
});

const state = {
	subscribers: new Set<DeviceSubscriber>(),
	profile: createDefaultProfile(),
	initialized: false,
	taskInitialized: false,
	resizeHandle: undefined as TimerHandle | undefined,
	calibrationStarted: false,
	calibrationFps: undefined as number | undefined,
	calibrationDelayHandle: undefined as TimerHandle | undefined,
	calibrationSamples: [] as number[],
	calibrationPrevious: 0,
	calibrating: false,
	longTaskCount: 0,
	lastLongTaskTier: 'high' as PerformanceTier,
	longTaskObserver: undefined as PerformanceObserver | undefined,
	reducedMotionQuery: undefined as MediaQueryList | undefined,
	coarsePointerQuery: undefined as MediaQueryList | undefined,
	finePointerQuery: undefined as MediaQueryList | undefined,
	hoverQuery: undefined as MediaQueryList | undefined,
	lastDprBucket: 0,
	wake: (() => {}) as (reason?: string) => void,
};

export const device = createTask({
	name: 'device',
	order: 10,
	state,
	preinit(context) {
		state.wake = context.wake;
		initDeviceProfile();
		if (state.taskInitialized) return;
		state.taskInitialized = true;
		onRouteAfterSwap(() => applyDeviceProfileToDocument());
		onRouteLoad(() => applyDeviceProfileToDocument());
	},
	update(frame) {
		if (!state.calibrating) return false;

		if (state.calibrationPrevious > 0 && frame.now > state.calibrationPrevious) {
			state.calibrationSamples.push(frame.now - state.calibrationPrevious);
		}
		state.calibrationPrevious = frame.now;

		if (state.calibrationSamples.length < DEVICE_THRESHOLDS.calibrationFrames) return;

		state.calibrating = false;
		const average = state.calibrationSamples.reduce((sum, value) => sum + value, 0) / state.calibrationSamples.length;
		state.calibrationSamples = [];
		state.calibrationPrevious = 0;
		if (average > 0) {
			state.calibrationFps = 1000 / average;
			refreshDeviceProfile('calibration:raf');
		}
		return false;
	},
});

const safeMatchMedia = (query: string): boolean => (isBrowser() ? (window.matchMedia?.(query).matches ?? false) : false);

const readHardwareConcurrency = (): number | undefined => {
	if (!isBrowser()) return undefined;
	const value = navigator.hardwareConcurrency;
	return Number.isFinite(value) && value > 0 ? value : undefined;
};

const readDeviceMemory = (): number | undefined => {
	if (!isBrowser()) return undefined;
	const value = (navigator as NavigatorWithSignals).deviceMemory;
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

const readConnection = (): NetworkInformationLike | undefined => (isBrowser() ? (navigator as NavigatorWithSignals).connection : undefined);

const readDpr = (): number => (isBrowser() ? window.devicePixelRatio || DEFAULT_DPR : DEFAULT_DPR);

const bucketDpr = (dpr: number): number => Math.round(dpr / DEVICE_THRESHOLDS.dprBucketStep) * DEVICE_THRESHOLDS.dprBucketStep;

const readViewportWidth = (): number => (isBrowser() ? window.innerWidth || document.documentElement.clientWidth || DEFAULT_VIEWPORT_WIDTH : DEFAULT_VIEWPORT_WIDTH);

const readViewportHeight = (): number => (isBrowser() ? window.innerHeight || document.documentElement.clientHeight || DEFAULT_VIEWPORT_HEIGHT : DEFAULT_VIEWPORT_HEIGHT);

const readInputProfile = (coarsePointer: boolean, finePointer: boolean): InputProfile => {
	if (coarsePointer && finePointer) return 'mixed';
	if (coarsePointer) return 'coarse';
	if (finePointer) return 'fine';
	return 'unknown';
};

const readNetworkProfile = (saveData: boolean | undefined, effectiveType: string | undefined): NetworkProfile => {
	if (saveData) return 'save-data';
	if (!effectiveType) return 'unknown';
	if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
	return 'normal';
};

const readDisplayProfile = (viewportWidth: number): DisplayProfile => {
	if (viewportWidth < DEVICE_THRESHOLDS.smallViewportWidth) return 'small';
	if (viewportWidth >= DEVICE_THRESHOLDS.largeViewportWidth) return 'large';
	return 'standard';
};

const isContentVisibilitySupported = (): boolean => isBrowser() && typeof CSS !== 'undefined' && CSS.supports?.('content-visibility', 'auto') === true;

const readLongTaskTier = (count: number): PerformanceTier => {
	if (count >= DEVICE_THRESHOLDS.longTaskLowCount) return 'low';
	if (count >= DEVICE_THRESHOLDS.longTaskMediumCount) return 'medium';
	return 'high';
};

const scoreTier = (reasons: string[], options: { reducedMotion: boolean; cores?: number; memory?: number; saveData?: boolean; rafFps?: number; longTasks?: number }): PerformanceTier => {
	if (options.reducedMotion) {
		reasons.push('motion:reduced');
		return 'low';
	}

	const lowSignals: string[] = [];
	const mediumSignals: string[] = [];

	if (options.cores !== undefined) {
		if (options.cores <= DEVICE_THRESHOLDS.lowCores) lowSignals.push(`cores:${options.cores}`);
		else if (options.cores <= DEVICE_THRESHOLDS.mediumCores) mediumSignals.push(`cores:${options.cores}`);
	}

	if (options.memory !== undefined) {
		if (options.memory <= DEVICE_THRESHOLDS.lowMemoryGb) lowSignals.push(`memory:${options.memory}`);
		else if (options.memory <= DEVICE_THRESHOLDS.mediumMemoryGb) mediumSignals.push(`memory:${options.memory}`);
	}

	if (options.rafFps !== undefined) {
		if (options.rafFps < DEVICE_THRESHOLDS.lowRafFps) lowSignals.push(`raf:${Math.round(options.rafFps)}`);
		else if (options.rafFps < DEVICE_THRESHOLDS.mediumRafFps) mediumSignals.push(`raf:${Math.round(options.rafFps)}`);
	}

	if (options.longTasks !== undefined) {
		const longTaskTier = readLongTaskTier(options.longTasks);
		if (longTaskTier === 'low') lowSignals.push(`longtask:${options.longTasks}`);
		else if (longTaskTier === 'medium') mediumSignals.push(`longtask:${options.longTasks}`);
	}

	if (options.saveData) mediumSignals.push('network:save-data');

	if (lowSignals.length > 0) {
		reasons.push(...lowSignals);
		return 'low';
	}

	if (mediumSignals.length > 0) {
		reasons.push(...mediumSignals);
		return 'medium';
	}

	reasons.push('signals:high');
	return 'high';
};

const applyTierHysteresis = (previous: DeviceProfile, next: PerformanceTier, reasons: string[]): PerformanceTier => {
	if (!previous.signals.clientReady || previous.tier === next) return next;
	if (previous.signals.reducedMotion) return next;
	if (next === 'low') return next;
	if (previous.tier === 'low' && next === 'medium' && state.calibrationFps !== undefined && state.calibrationFps < DEVICE_THRESHOLDS.mediumRafFps) {
		reasons.push('hysteresis:hold-low');
		return 'low';
	}
	return next;
};

const deriveMotionQuality = (tier: PerformanceTier, reducedMotion: boolean, saveData: boolean | undefined): MotionQuality => {
	if (reducedMotion) return 'reduced';
	if (saveData || tier !== 'high') return 'no-blur';
	return 'full';
};

const deriveDprCap = (tier: PerformanceTier, displayProfile: DisplayProfile, dpr: number): number => {
	if (tier === 'low') return 1;
	if (tier === 'medium') return displayProfile === 'small' && dpr >= DEVICE_THRESHOLDS.highDprMobile ? 1.25 : 1.5;
	return displayProfile === 'small' ? 1.5 : 2;
};

const buildProfile = (source: DeviceProfileSource, reason: string): DeviceProfile => {
	if (!isBrowser()) return state.profile;

	const connection = readConnection();
	const reducedMotion = state.reducedMotionQuery?.matches ?? safeMatchMedia('(prefers-reduced-motion: reduce)');
	const coarsePointer = state.coarsePointerQuery?.matches ?? safeMatchMedia('(hover: none), (pointer: coarse)');
	const finePointer = state.finePointerQuery?.matches ?? safeMatchMedia('(hover: hover), (pointer: fine)');
	const hover = state.hoverQuery?.matches ?? safeMatchMedia('(hover: hover)');
	const hardwareConcurrency = readHardwareConcurrency();
	const deviceMemory = readDeviceMemory();
	const devicePixelRatio = readDpr();
	const saveData = connection?.saveData;
	const effectiveType = connection?.effectiveType;
	const viewportWidth = readViewportWidth();
	const viewportHeight = readViewportHeight();
	const networkProfile = readNetworkProfile(saveData, effectiveType);
	const displayProfile = readDisplayProfile(viewportWidth);
	const reasons = [reason];
	const tierCandidate = scoreTier(reasons, {
		reducedMotion,
		...(hardwareConcurrency !== undefined ? { cores: hardwareConcurrency } : {}),
		...(deviceMemory !== undefined ? { memory: deviceMemory } : {}),
		...(saveData !== undefined ? { saveData } : {}),
		...(state.calibrationFps !== undefined ? { rafFps: state.calibrationFps } : {}),
		...(state.longTaskCount > 0 ? { longTasks: state.longTaskCount } : {}),
	});
	const tier = applyTierHysteresis(state.profile, tierCandidate, reasons);
	const motionQuality = deriveMotionQuality(tier, reducedMotion, saveData);
	const inputProfile = readInputProfile(coarsePointer, finePointer);
	const dprCap = deriveDprCap(tier, displayProfile, devicePixelRatio);

	const confidence: DeviceProfileConfidence = source === 'calibrated' ? 'high' : hardwareConcurrency !== undefined || deviceMemory !== undefined ? 'medium' : 'low';
	const allowFineHover = hover && inputProfile !== 'coarse';

	return {
		version: 1,
		source,
		confidence,
		generation: state.profile.generation + 1,
		updatedAt: performance.now(),
		tier,
		motionQuality,
		inputProfile,
		networkProfile,
		displayProfile,
		dprCap,
		lineProfile: tier === 'low' || inputProfile === 'coarse' ? 'lite' : 'full',
		allowWebglMotion: motionQuality !== 'reduced' && tier !== 'low',
		allowWebglHighDpr: motionQuality !== 'reduced' && tier === 'high',
		allowHoverVideo: motionQuality !== 'reduced' && networkProfile !== 'save-data' && tier !== 'low' && allowFineHover,
		allowPixelReveal: motionQuality !== 'reduced' && tier !== 'low',
		allowContentVisibility: isContentVisibilitySupported(),
		reasons,
		signals: {
			clientReady: true,
			reducedMotion,
			coarsePointer,
			finePointer,
			hover,
			...(hardwareConcurrency !== undefined ? { hardwareConcurrency } : {}),
			...(deviceMemory !== undefined ? { deviceMemory } : {}),
			devicePixelRatio,
			...(saveData !== undefined ? { saveData } : {}),
			...(effectiveType ? { effectiveType } : {}),
			viewportWidth,
			viewportHeight,
			...(state.calibrationFps !== undefined ? { rafFps: state.calibrationFps } : {}),
			...(state.longTaskCount > 0 ? { longTaskCount: state.longTaskCount } : {}),
		},
	};
};

const notify = (): void => {
	for (const subscriber of state.subscribers) {
		subscriber(state.profile);
	}
};

const setProfile = (nextProfile: DeviceProfile): DeviceProfile => {
	state.profile = nextProfile;
	applyDeviceProfileToDocument(state.profile);
	notify();
	return state.profile;
};

export const getDeviceProfile = (): DeviceProfile => state.profile;

export const applyDeviceProfileToDocument = (nextProfile: DeviceProfile = state.profile): void => {
	if (!isBrowser()) return;
	const root = document.documentElement;
	root.dataset['performanceTier'] = nextProfile.tier;
	root.dataset['motionQuality'] = nextProfile.motionQuality;
	root.dataset['inputProfile'] = nextProfile.inputProfile;
	root.dataset['networkProfile'] = nextProfile.networkProfile;
	root.dataset['displayProfile'] = nextProfile.displayProfile;
	root.dataset['deviceProfileSource'] = nextProfile.source;
};

export const refreshDeviceProfile = (reason = 'refresh'): DeviceProfile => setProfile(buildProfile(state.calibrationFps === undefined ? 'static-signals' : 'calibrated', reason));

export const subscribeDeviceProfile = (callback: DeviceSubscriber): (() => void) => {
	state.subscribers.add(callback);
	callback(state.profile);
	return () => {
		state.subscribers.delete(callback);
	};
};

export const getDprCap = (nextProfile: DeviceProfile = state.profile, options?: { mobileAware?: boolean }): number => {
	if (!options?.mobileAware) return nextProfile.dprCap;
	if (nextProfile.displayProfile === 'small') return Math.min(nextProfile.dprCap, nextProfile.tier === 'high' ? 1.5 : 1.25);
	return nextProfile.dprCap;
};

export const getLineRevealProfile = (nextProfile: DeviceProfile = state.profile): LineDeviceProfile => nextProfile.lineProfile;

export const canUseBlurMotion = (nextProfile: DeviceProfile = state.profile): boolean => nextProfile.motionQuality === 'full';

export const canUseWebglMotion = (nextProfile: DeviceProfile = state.profile): boolean => nextProfile.allowWebglMotion;

export const canUseHoverVideo = (nextProfile: DeviceProfile = state.profile): boolean => nextProfile.allowHoverVideo;

export const canUsePixelReveal = (nextProfile: DeviceProfile = state.profile): boolean => nextProfile.allowPixelReveal;

const queueRefresh = (reason: string): void => {
	if (!isBrowser()) return;

	state.resizeHandle?.cancel();
	state.resizeHandle = setTimer('device.refresh', DEVICE_THRESHOLDS.resizeRecomputeMs, () => {
		state.resizeHandle = undefined;
		refreshDeviceProfile(reason);
	});
};

const handleResize = (): void => {
	const nextDprBucket = bucketDpr(readDpr());
	if (nextDprBucket !== state.lastDprBucket) {
		state.lastDprBucket = nextDprBucket;
		queueRefresh('resize:dpr');
		return;
	}
	queueRefresh('resize');
};

const scheduleCalibration = (): void => {
	if (!isBrowser() || state.calibrationStarted || state.profile.signals.reducedMotion) return;
	state.calibrationStarted = true;

	const run = (): void => {
		state.calibrationSamples = [];
		state.calibrationPrevious = 0;
		state.calibrating = true;
		state.wake('device:calibration');
	};

	const win = window as WindowWithIdle;
	if (typeof win.requestIdleCallback === 'function') {
		win.requestIdleCallback(() => run(), { timeout: DEVICE_THRESHOLDS.calibrationDelayMs });
		return;
	}

	state.calibrationDelayHandle?.cancel();
	state.calibrationDelayHandle = setTimer('device.calibration.delay', DEVICE_THRESHOLDS.calibrationDelayMs, () => {
		state.calibrationDelayHandle = undefined;
		run();
	});
};

const observeLongTasks = (): void => {
	if (!isBrowser() || typeof PerformanceObserver === 'undefined') return;

	try {
		state.longTaskObserver = new PerformanceObserver((list) => {
			const previousTier = state.lastLongTaskTier;
			state.longTaskCount += list.getEntries().length;
			state.lastLongTaskTier = readLongTaskTier(state.longTaskCount);
			if (state.lastLongTaskTier === previousTier) return;
			refreshDeviceProfile('observer:longtask');
		});
		state.longTaskObserver.observe({ entryTypes: ['longtask'] });
	} catch {
		state.longTaskObserver = undefined;
	}
};

const addMediaQueryListener = (query: MediaQueryList, callback: () => void): void => {
	if (typeof query.addEventListener === 'function') {
		query.addEventListener('change', callback);
		return;
	}

	const legacyQuery = query as unknown as { addListener?: (listener: () => void) => void };
	legacyQuery.addListener?.(callback);
};

const setupListeners = (): void => {
	if (!isBrowser()) return;

	state.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	state.coarsePointerQuery = window.matchMedia('(hover: none), (pointer: coarse)');
	state.finePointerQuery = window.matchMedia('(hover: hover), (pointer: fine)');
	state.hoverQuery = window.matchMedia('(hover: hover)');
	state.lastDprBucket = bucketDpr(readDpr());

	const refreshStatic = (): void => {
		refreshDeviceProfile('media-query:change');
	};
	addMediaQueryListener(state.reducedMotionQuery, refreshStatic);
	addMediaQueryListener(state.coarsePointerQuery, refreshStatic);
	addMediaQueryListener(state.finePointerQuery, refreshStatic);
	addMediaQueryListener(state.hoverQuery, refreshStatic);

	const connection = readConnection();
	connection?.addEventListener?.('change', () => refreshDeviceProfile('network:change'));

	window.addEventListener('resize', handleResize, { passive: true });
	window.addEventListener('pageshow', (event) => {
		if (event.persisted) refreshDeviceProfile('pageshow:bf-cache');
		applyDeviceProfileToDocument();
	});
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) refreshDeviceProfile('visibility:visible');
	});
	observeLongTasks();
};

export const initDeviceProfile = (options: DeviceProfileOptions = {}): DeviceProfile => {
	if (!isBrowser()) return state.profile;

	if (state.initialized) {
		applyDeviceProfileToDocument();
		return state.profile;
	}

	state.initialized = true;
	setupListeners();
	setProfile(buildProfile('static-signals', 'init:static-signals'));

	if (options.calibrate ?? true) scheduleCalibration();
	return state.profile;
};
