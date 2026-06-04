export type PerformanceTier = 'low' | 'medium' | 'high';
export type MotionQuality = 'reduced' | 'no-blur' | 'full';
export type InputProfile = 'coarse' | 'fine' | 'mixed' | 'unknown';
export type NetworkProfile = 'save-data' | 'slow' | 'normal' | 'unknown';
export type DisplayProfile = 'small' | 'standard' | 'large';
export type DeviceProfileSource = 'ssr' | 'boot' | 'static-signals' | 'calibrated' | 'override' | 'fallback';
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

const STORAGE_TIER_KEY = 'u29dc:device:tier';
const STORAGE_MOTION_KEY = 'u29dc:device:motion';
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

const subscribers = new Set<DeviceSubscriber>();
let profile = createDefaultProfile();
let initialized = false;
let resizeHandle = 0;
let calibrationStarted = false;
let calibrationFps: number | undefined;
let longTaskCount = 0;
let lastLongTaskTier: PerformanceTier = 'high';
let longTaskObserver: PerformanceObserver | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let coarsePointerQuery: MediaQueryList | undefined;
let finePointerQuery: MediaQueryList | undefined;
let hoverQuery: MediaQueryList | undefined;
let lastDprBucket = 0;

const safeMatchMedia = (query: string): boolean => (isBrowser() ? (window.matchMedia?.(query).matches ?? false) : false);

const readStorageValue = (key: string): string | undefined => {
	if (!isBrowser()) return undefined;

	try {
		return window.localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
};

const isPerformanceTier = (value: string | undefined): value is PerformanceTier => value === 'low' || value === 'medium' || value === 'high';

const isMotionQuality = (value: string | undefined): value is MotionQuality => value === 'reduced' || value === 'no-blur' || value === 'full';

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
	if (previous.tier === 'low' && next === 'medium' && calibrationFps !== undefined && calibrationFps < DEVICE_THRESHOLDS.mediumRafFps) {
		reasons.push('hysteresis:hold-low');
		return 'low';
	}
	return next;
};

const deriveMotionQuality = (tier: PerformanceTier, reducedMotion: boolean, saveData: boolean | undefined, override?: MotionQuality): MotionQuality => {
	if (override) return override;
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
	if (!isBrowser()) return profile;

	const connection = readConnection();
	const reducedMotion = reducedMotionQuery?.matches ?? safeMatchMedia('(prefers-reduced-motion: reduce)');
	const coarsePointer = coarsePointerQuery?.matches ?? safeMatchMedia('(hover: none), (pointer: coarse)');
	const finePointer = finePointerQuery?.matches ?? safeMatchMedia('(hover: hover), (pointer: fine)');
	const hover = hoverQuery?.matches ?? safeMatchMedia('(hover: hover)');
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
	const overrideTier = readStorageValue(STORAGE_TIER_KEY);
	const overrideMotion = readStorageValue(STORAGE_MOTION_KEY);
	const motionOverride = isMotionQuality(overrideMotion) ? overrideMotion : undefined;
	const tierCandidate = scoreTier(reasons, {
		reducedMotion,
		...(hardwareConcurrency !== undefined ? { cores: hardwareConcurrency } : {}),
		...(deviceMemory !== undefined ? { memory: deviceMemory } : {}),
		...(saveData !== undefined ? { saveData } : {}),
		...(calibrationFps !== undefined ? { rafFps: calibrationFps } : {}),
		...(longTaskCount > 0 ? { longTasks: longTaskCount } : {}),
	});
	const tier = isPerformanceTier(overrideTier) ? overrideTier : applyTierHysteresis(profile, tierCandidate, reasons);
	const motionQuality = deriveMotionQuality(tier, reducedMotion, saveData, motionOverride);
	const inputProfile = readInputProfile(coarsePointer, finePointer);
	const dprCap = deriveDprCap(tier, displayProfile, devicePixelRatio);
	const isOverride = isPerformanceTier(overrideTier) || Boolean(motionOverride);
	if (isPerformanceTier(overrideTier)) reasons.push(`override:tier=${overrideTier}`);
	if (motionOverride) reasons.push(`override:motion=${motionOverride}`);

	const resolvedSource: DeviceProfileSource = isOverride ? 'override' : source;
	const confidence: DeviceProfileConfidence = resolvedSource === 'calibrated' || isOverride ? 'high' : hardwareConcurrency !== undefined || deviceMemory !== undefined ? 'medium' : 'low';
	const allowFineHover = hover && inputProfile !== 'coarse';

	return {
		version: 1,
		source: resolvedSource,
		confidence,
		generation: profile.generation + 1,
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
			...(calibrationFps !== undefined ? { rafFps: calibrationFps } : {}),
			...(longTaskCount > 0 ? { longTaskCount } : {}),
		},
	};
};

const notify = (): void => {
	for (const subscriber of subscribers) {
		subscriber(profile);
	}
};

const setProfile = (nextProfile: DeviceProfile): DeviceProfile => {
	profile = nextProfile;
	applyDeviceProfileToDocument(profile);
	notify();
	return profile;
};

export const getDeviceProfile = (): DeviceProfile => profile;

export const applyDeviceProfileToDocument = (nextProfile: DeviceProfile = profile): void => {
	if (!isBrowser()) return;
	const root = document.documentElement;
	root.dataset['performanceTier'] = nextProfile.tier;
	root.dataset['motionQuality'] = nextProfile.motionQuality;
	root.dataset['inputProfile'] = nextProfile.inputProfile;
	root.dataset['networkProfile'] = nextProfile.networkProfile;
	root.dataset['displayProfile'] = nextProfile.displayProfile;
	root.dataset['deviceProfileSource'] = nextProfile.source;
};

export const refreshDeviceProfile = (reason = 'refresh'): DeviceProfile => setProfile(buildProfile(calibrationFps === undefined ? 'static-signals' : 'calibrated', reason));

export const subscribeDeviceProfile = (callback: DeviceSubscriber): (() => void) => {
	subscribers.add(callback);
	callback(profile);
	return () => {
		subscribers.delete(callback);
	};
};

export const getDprCap = (nextProfile: DeviceProfile = profile, options?: { mobileAware?: boolean }): number => {
	if (!options?.mobileAware) return nextProfile.dprCap;
	if (nextProfile.displayProfile === 'small') return Math.min(nextProfile.dprCap, nextProfile.tier === 'high' ? 1.5 : 1.25);
	return nextProfile.dprCap;
};

export const getLineRevealProfile = (nextProfile: DeviceProfile = profile): LineDeviceProfile => nextProfile.lineProfile;

export const canUseBlurMotion = (nextProfile: DeviceProfile = profile): boolean => nextProfile.motionQuality === 'full';

export const canUseWebglMotion = (nextProfile: DeviceProfile = profile): boolean => nextProfile.allowWebglMotion;

export const canUseHoverVideo = (nextProfile: DeviceProfile = profile): boolean => nextProfile.allowHoverVideo;

export const canUsePixelReveal = (nextProfile: DeviceProfile = profile): boolean => nextProfile.allowPixelReveal;

const queueRefresh = (reason: string): void => {
	if (!isBrowser()) return;

	window.clearTimeout(resizeHandle);
	resizeHandle = window.setTimeout(() => {
		resizeHandle = 0;
		refreshDeviceProfile(reason);
	}, DEVICE_THRESHOLDS.resizeRecomputeMs);
};

const handleResize = (): void => {
	const nextDprBucket = bucketDpr(readDpr());
	if (nextDprBucket !== lastDprBucket) {
		lastDprBucket = nextDprBucket;
		queueRefresh('resize:dpr');
		return;
	}
	queueRefresh('resize');
};

const scheduleCalibration = (): void => {
	if (!isBrowser() || calibrationStarted || profile.signals.reducedMotion) return;
	calibrationStarted = true;

	const run = (): void => {
		const samples: number[] = [];
		let previous = 0;
		const sample = (timestamp: number): void => {
			if (previous > 0) samples.push(timestamp - previous);
			previous = timestamp;
			if (samples.length < DEVICE_THRESHOLDS.calibrationFrames) {
				window.requestAnimationFrame(sample);
				return;
			}

			const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
			if (average > 0) {
				calibrationFps = 1000 / average;
				refreshDeviceProfile('calibration:raf');
			}
		};

		window.requestAnimationFrame(sample);
	};

	const win = window as WindowWithIdle;
	if (typeof win.requestIdleCallback === 'function') {
		win.requestIdleCallback(() => run(), { timeout: DEVICE_THRESHOLDS.calibrationDelayMs });
		return;
	}

	window.setTimeout(run, DEVICE_THRESHOLDS.calibrationDelayMs);
};

const observeLongTasks = (): void => {
	if (!isBrowser() || typeof PerformanceObserver === 'undefined') return;

	try {
		longTaskObserver = new PerformanceObserver((list) => {
			const previousTier = lastLongTaskTier;
			longTaskCount += list.getEntries().length;
			lastLongTaskTier = readLongTaskTier(longTaskCount);
			if (lastLongTaskTier === previousTier) return;
			refreshDeviceProfile('observer:longtask');
		});
		longTaskObserver.observe({ entryTypes: ['longtask'] });
	} catch {
		longTaskObserver = undefined;
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

	reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	coarsePointerQuery = window.matchMedia('(hover: none), (pointer: coarse)');
	finePointerQuery = window.matchMedia('(hover: hover), (pointer: fine)');
	hoverQuery = window.matchMedia('(hover: hover)');
	lastDprBucket = bucketDpr(readDpr());

	const refreshStatic = (): void => {
		refreshDeviceProfile('media-query:change');
	};
	addMediaQueryListener(reducedMotionQuery, refreshStatic);
	addMediaQueryListener(coarsePointerQuery, refreshStatic);
	addMediaQueryListener(finePointerQuery, refreshStatic);
	addMediaQueryListener(hoverQuery, refreshStatic);

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
	document.addEventListener('astro:after-swap', () => applyDeviceProfileToDocument());
	document.addEventListener('astro:page-load', () => applyDeviceProfileToDocument());
	observeLongTasks();
};

export const initDeviceProfile = (options: DeviceProfileOptions = {}): DeviceProfile => {
	if (!isBrowser()) return profile;

	if (initialized) {
		applyDeviceProfileToDocument();
		return profile;
	}

	initialized = true;
	setupListeners();
	setProfile(buildProfile('static-signals', 'init:static-signals'));

	if (options.calibrate ?? true) scheduleCalibration();
	return profile;
};
