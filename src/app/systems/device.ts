import { BaseModule, type Context, type Frame } from '../core/module';
import {
	type DeviceProfile,
	type DeviceProfileConfidence,
	type DeviceProfileSource,
	type DisplayProfile,
	type InputProfile,
	type LineDeviceProfile,
	type MotionQuality,
	type NetworkProfile,
	type PerformanceTier,
} from '../core/state';
import { setTimer, type TimerHandle } from '../core/timer';
import { onRouteAfterSwap, onRouteLoad } from './route';

export type { DeviceProfile, LineDeviceProfile, PerformanceTier } from '../core/state';

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

class DeviceOwner extends BaseModule {
	readonly name = 'device';

	private subscribers = new Set<DeviceSubscriber>();
	private profile = createDefaultProfile();
	private initialized = false;
	private routeBound = false;
	private resizeHandle: TimerHandle | undefined;
	private calibrationStarted = false;
	private calibrationFps: number | undefined;
	private calibrationDelayHandle: TimerHandle | undefined;
	private calibrationSamples: number[] = [];
	private calibrationPrevious = 0;
	private calibrating = false;
	private longTaskCount = 0;
	private lastLongTaskTier: PerformanceTier = 'high';
	private longTaskObserver: PerformanceObserver | undefined;
	private reducedMotionQuery: MediaQueryList | undefined;
	private coarsePointerQuery: MediaQueryList | undefined;
	private finePointerQuery: MediaQueryList | undefined;
	private hoverQuery: MediaQueryList | undefined;
	private lastDprBucket = 0;

	override preinit(context: Context): void {
		super.preinit(context);
		this.initProfile();
		if (this.routeBound) return;
		this.routeBound = true;
		this.addCleanup(onRouteAfterSwap(() => this.applyToDocument()));
		this.addCleanup(onRouteLoad(() => this.applyToDocument()));
	}

	override update(frame: Frame): boolean | void {
		if (!this.calibrating) return false;

		if (this.calibrationPrevious > 0 && frame.now > this.calibrationPrevious) {
			this.calibrationSamples.push(frame.now - this.calibrationPrevious);
		}
		this.calibrationPrevious = frame.now;

		if (this.calibrationSamples.length < DEVICE_THRESHOLDS.calibrationFrames) return true;

		this.calibrating = false;
		const average = this.calibrationSamples.reduce((sum, value) => sum + value, 0) / this.calibrationSamples.length;
		this.calibrationSamples = [];
		this.calibrationPrevious = 0;
		if (average > 0) {
			this.calibrationFps = 1000 / average;
			this.refreshProfile('calibration:raf');
		}
		return false;
	}

	getProfile(): DeviceProfile {
		return this.profile;
	}

	applyToDocument(nextProfile: DeviceProfile = this.profile): void {
		if (!isBrowser()) return;
		const root = document.documentElement;
		root.dataset['performanceTier'] = nextProfile.tier;
		root.dataset['motionQuality'] = nextProfile.motionQuality;
		root.dataset['inputProfile'] = nextProfile.inputProfile;
		root.dataset['networkProfile'] = nextProfile.networkProfile;
		root.dataset['displayProfile'] = nextProfile.displayProfile;
		root.dataset['deviceProfileSource'] = nextProfile.source;
	}

	refreshProfile(reason = 'refresh'): DeviceProfile {
		return this.setProfile(this.buildProfile(this.calibrationFps === undefined ? 'static-signals' : 'calibrated', reason));
	}

	subscribe(callback: DeviceSubscriber): () => void {
		this.subscribers.add(callback);
		callback(this.profile);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	getDprCap(nextProfile: DeviceProfile = this.profile, options?: { mobileAware?: boolean }): number {
		if (!options?.mobileAware) return nextProfile.dprCap;
		if (nextProfile.displayProfile === 'small') return Math.min(nextProfile.dprCap, nextProfile.tier === 'high' ? 1.5 : 1.25);
		return nextProfile.dprCap;
	}

	getLineRevealProfile(nextProfile: DeviceProfile = this.profile): LineDeviceProfile {
		return nextProfile.lineProfile;
	}

	canUseBlurMotion(nextProfile: DeviceProfile = this.profile): boolean {
		return nextProfile.motionQuality === 'full';
	}

	canUseWebglMotion(nextProfile: DeviceProfile = this.profile): boolean {
		return nextProfile.allowWebglMotion;
	}

	canUseHoverVideo(nextProfile: DeviceProfile = this.profile): boolean {
		return nextProfile.allowHoverVideo;
	}

	canUsePixelReveal(nextProfile: DeviceProfile = this.profile): boolean {
		return nextProfile.allowPixelReveal;
	}

	initProfile(options: DeviceProfileOptions = {}): DeviceProfile {
		if (!isBrowser()) return this.profile;

		if (this.initialized) {
			this.applyToDocument();
			return this.profile;
		}

		this.initialized = true;
		this.setupListeners();
		this.setProfile(this.buildProfile('static-signals', 'init:static-signals'));

		if (options.calibrate ?? true) this.scheduleCalibration();
		return this.profile;
	}

	private notify(): void {
		for (const subscriber of this.subscribers) {
			subscriber(this.profile);
		}
	}

	private setProfile(nextProfile: DeviceProfile): DeviceProfile {
		this.profile = nextProfile;
		this.applyToDocument(this.profile);
		this.notify();
		this.requestFrame('device:profile');
		return this.profile;
	}

	private buildProfile(source: DeviceProfileSource, reason: string): DeviceProfile {
		if (!isBrowser()) return this.profile;

		const connection = readConnection();
		const reducedMotion = this.reducedMotionQuery?.matches ?? safeMatchMedia('(prefers-reduced-motion: reduce)');
		const coarsePointer = this.coarsePointerQuery?.matches ?? safeMatchMedia('(hover: none), (pointer: coarse)');
		const finePointer = this.finePointerQuery?.matches ?? safeMatchMedia('(hover: hover), (pointer: fine)');
		const hover = this.hoverQuery?.matches ?? safeMatchMedia('(hover: hover)');
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
			...(this.calibrationFps !== undefined ? { rafFps: this.calibrationFps } : {}),
			...(this.longTaskCount > 0 ? { longTasks: this.longTaskCount } : {}),
		});
		const tier = this.applyTierHysteresis(this.profile, tierCandidate, reasons);
		const motionQuality = deriveMotionQuality(tier, reducedMotion, saveData);
		const inputProfile = readInputProfile(coarsePointer, finePointer);
		const dprCap = deriveDprCap(tier, displayProfile, devicePixelRatio);

		const confidence: DeviceProfileConfidence = source === 'calibrated' ? 'high' : hardwareConcurrency !== undefined || deviceMemory !== undefined ? 'medium' : 'low';
		const allowFineHover = hover && inputProfile !== 'coarse';

		return {
			version: 1,
			source,
			confidence,
			generation: this.profile.generation + 1,
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
				...(this.calibrationFps !== undefined ? { rafFps: this.calibrationFps } : {}),
				...(this.longTaskCount > 0 ? { longTaskCount: this.longTaskCount } : {}),
			},
		};
	}

	private applyTierHysteresis(previous: DeviceProfile, next: PerformanceTier, reasons: string[]): PerformanceTier {
		if (!previous.signals.clientReady || previous.tier === next) return next;
		if (previous.signals.reducedMotion) return next;
		if (next === 'low') return next;
		if (previous.tier === 'low' && next === 'medium' && this.calibrationFps !== undefined && this.calibrationFps < DEVICE_THRESHOLDS.mediumRafFps) {
			reasons.push('hysteresis:hold-low');
			return 'low';
		}
		return next;
	}

	private queueRefresh(reason: string): void {
		if (!isBrowser()) return;

		this.resizeHandle?.cancel();
		this.resizeHandle = setTimer('device.refresh', DEVICE_THRESHOLDS.resizeRecomputeMs, () => {
			this.resizeHandle = undefined;
			this.refreshProfile(reason);
		});
	}

	private readonly handleResize = (): void => {
		const nextDprBucket = bucketDpr(readDpr());
		if (nextDprBucket !== this.lastDprBucket) {
			this.lastDprBucket = nextDprBucket;
			this.queueRefresh('resize:dpr');
			return;
		}
		this.queueRefresh('resize');
	};

	private scheduleCalibration(): void {
		if (!isBrowser() || this.calibrationStarted || this.profile.signals.reducedMotion) return;
		this.calibrationStarted = true;

		const run = (): void => {
			this.calibrationSamples = [];
			this.calibrationPrevious = 0;
			this.calibrating = true;
			this.requestFrame('device:calibration');
		};

		const win = window as WindowWithIdle;
		if (typeof win.requestIdleCallback === 'function') {
			win.requestIdleCallback(() => run(), { timeout: DEVICE_THRESHOLDS.calibrationDelayMs });
			return;
		}

		this.calibrationDelayHandle?.cancel();
		this.calibrationDelayHandle = setTimer('device.calibration.delay', DEVICE_THRESHOLDS.calibrationDelayMs, () => {
			this.calibrationDelayHandle = undefined;
			run();
		});
	}

	private observeLongTasks(): void {
		if (!isBrowser() || typeof PerformanceObserver === 'undefined') return;

		try {
			this.longTaskObserver = new PerformanceObserver((list) => {
				const previousTier = this.lastLongTaskTier;
				this.longTaskCount += list.getEntries().length;
				this.lastLongTaskTier = readLongTaskTier(this.longTaskCount);
				if (this.lastLongTaskTier === previousTier) return;
				this.refreshProfile('observer:longtask');
			});
			this.longTaskObserver.observe({ entryTypes: ['longtask'] });
		} catch {
			this.longTaskObserver = undefined;
		}
	}

	private setupListeners(): void {
		if (!isBrowser()) return;

		this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.coarsePointerQuery = window.matchMedia('(hover: none), (pointer: coarse)');
		this.finePointerQuery = window.matchMedia('(hover: hover), (pointer: fine)');
		this.hoverQuery = window.matchMedia('(hover: hover)');
		this.lastDprBucket = bucketDpr(readDpr());

		const refreshStatic = (): void => {
			this.refreshProfile('media-query:change');
		};
		addMediaQueryListener(this.reducedMotionQuery, refreshStatic);
		addMediaQueryListener(this.coarsePointerQuery, refreshStatic);
		addMediaQueryListener(this.finePointerQuery, refreshStatic);
		addMediaQueryListener(this.hoverQuery, refreshStatic);

		const connection = readConnection();
		connection?.addEventListener?.('change', () => this.refreshProfile('network:change'));

		window.addEventListener('resize', this.handleResize, { passive: true });
		window.addEventListener('pageshow', (event) => {
			if (event.persisted) this.refreshProfile('pageshow:bf-cache');
			this.applyToDocument();
		});
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) this.refreshProfile('visibility:visible');
		});
		this.observeLongTasks();
	}
}

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

const addMediaQueryListener = (query: MediaQueryList, callback: () => void): void => {
	if (typeof query.addEventListener === 'function') {
		query.addEventListener('change', callback);
		return;
	}

	const legacyQuery = query as unknown as { addListener?: (listener: () => void) => void };
	legacyQuery.addListener?.(callback);
};

export const device = new DeviceOwner();
export const getDeviceProfile = (): DeviceProfile => device.getProfile();
export const applyDeviceProfileToDocument = (nextProfile?: DeviceProfile): void => device.applyToDocument(nextProfile);
export const refreshDeviceProfile = (reason = 'refresh'): DeviceProfile => device.refreshProfile(reason);
export const subscribeDeviceProfile = (callback: DeviceSubscriber): (() => void) => device.subscribe(callback);
export const getDprCap = (nextProfile?: DeviceProfile, options?: { mobileAware?: boolean }): number => device.getDprCap(nextProfile, options);
export const getLineRevealProfile = (nextProfile?: DeviceProfile): LineDeviceProfile => device.getLineRevealProfile(nextProfile);
export const canUseBlurMotion = (nextProfile?: DeviceProfile): boolean => device.canUseBlurMotion(nextProfile);
export const canUseWebglMotion = (nextProfile?: DeviceProfile): boolean => device.canUseWebglMotion(nextProfile);
export const canUseHoverVideo = (nextProfile?: DeviceProfile): boolean => device.canUseHoverVideo(nextProfile);
export const canUsePixelReveal = (nextProfile?: DeviceProfile): boolean => device.canUsePixelReveal(nextProfile);
export const initDeviceProfile = (options?: DeviceProfileOptions): DeviceProfile => device.initProfile(options);
