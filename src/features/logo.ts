import { canUseWebglMotion, getDeviceProfile, getDprCap, initDeviceProfile, subscribeDeviceProfile, type DeviceProfile } from '../lib/device';
import { createRenderer, type Renderer, type State, type Theme } from '../lib/logo';
import { getWebglDiagnosticsMode, recordWebglDiagnostic } from '../lib/webgl';

type ThemePreference = Theme | 'system';

type Config = {
	width: number;
	mobileWidth: number;
	blurStart: number;
	defaultBlurIntensity: number;
	mouseBlurIntensity: number;
	mobileMouseBlurIntensity: number;
	mouseBlurSize: number;
	mobileMouseBlurSize: number;
	roundness: number;
	noiseIntensity: number;
	noiseScale: number;
	theme: ThemePreference;
	enableObservation: boolean;
};

type Controller = {
	dispose: () => void;
};

const LOGO_SELECTOR = '[data-logo]';
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const controllers = new WeakMap<HTMLElement, Controller>();
const activeControllers = new Set<Controller>();
initDeviceProfile();

const parseNumber = (value: string | undefined, fallback: number): number => {
	if (!value) return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return fallback;
};

const parseTheme = (value: string | undefined): ThemePreference => {
	if (value === 'light' || value === 'dark') return value;
	return 'system';
};

const readConfig = (element: HTMLElement): Config => {
	const width = parseNumber(element.dataset['width'], 200);
	const mouseBlurIntensity = parseNumber(element.dataset['mouseBlurIntensity'], 1.0);
	const mouseBlurSize = parseNumber(element.dataset['mouseBlurSize'], 0.5);

	return {
		width,
		mobileWidth: parseNumber(element.dataset['mobileWidth'], width),
		blurStart: parseNumber(element.dataset['blurStart'], 1.0),
		defaultBlurIntensity: parseNumber(element.dataset['defaultBlurIntensity'], 0.5),
		mouseBlurIntensity,
		mobileMouseBlurIntensity: parseNumber(element.dataset['mobileMouseBlurIntensity'], mouseBlurIntensity),
		mouseBlurSize,
		mobileMouseBlurSize: parseNumber(element.dataset['mobileMouseBlurSize'], mouseBlurSize),
		roundness: parseNumber(element.dataset['roundness'], 0.5),
		noiseIntensity: parseNumber(element.dataset['noiseIntensity'], 0.15),
		noiseScale: parseNumber(element.dataset['noiseScale'], 150),
		theme: parseTheme(element.dataset['theme']),
		enableObservation: parseBoolean(element.dataset['enableObservation'], true),
	};
};

const resolveTheme = (preference: ThemePreference, darkQuery: MediaQueryList): Theme => {
	if (preference === 'light' || preference === 'dark') return preference;

	const rootTheme = document.documentElement.dataset['theme'];
	if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;

	return darkQuery.matches ? 'dark' : 'light';
};

const buildState = (config: Config, isMobile: boolean, theme: Theme): State => {
	const width = isMobile ? config.mobileWidth : config.width;

	return {
		width,
		height: width / 2,
		blurStart: config.blurStart,
		defaultBlurIntensity: config.defaultBlurIntensity,
		mouseBlurIntensity: isMobile ? config.mobileMouseBlurIntensity : config.mouseBlurIntensity,
		mouseBlurSize: isMobile ? config.mobileMouseBlurSize : config.mouseBlurSize,
		roundness: config.roundness,
		noiseIntensity: config.noiseIntensity,
		noiseScale: config.noiseScale,
		theme,
	};
};

const showFallback = (element: HTMLElement, canvas: HTMLCanvasElement, fallback: HTMLElement, state: State, options: { failed: boolean; reason: string }): void => {
	canvas.hidden = true;
	fallback.hidden = false;
	fallback.style.fontSize = `${Math.max(state.width * 0.16, 16)}px`;
	fallback.dataset['theme'] = state.theme;
	element.dataset['fallback'] = options.reason;
	if (options.failed) {
		element.dataset['failed'] = 'true';
	} else {
		delete element.dataset['failed'];
	}
};

const hideFallback = (element: HTMLElement, canvas: HTMLCanvasElement, fallback: HTMLElement): void => {
	canvas.hidden = false;
	fallback.hidden = true;
	delete fallback.dataset['theme'];
	delete element.dataset['fallback'];
	delete element.dataset['failed'];
};

const createController = (element: HTMLElement): Controller | undefined => {
	if (controllers.has(element)) return undefined;

	const canvas = element.querySelector<HTMLCanvasElement>('[data-logo-canvas]');
	const fallback = element.querySelector<HTMLElement>('[data-logo-fallback]');
	if (!canvas || !fallback) return undefined;

	const config = readConfig(element);
	const mobileQuery = window.matchMedia(MOBILE_QUERY);
	const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	const darkQuery = window.matchMedia(DARK_QUERY);

	let isMobile = mobileQuery.matches;
	let prefersReducedMotion = motionQuery.matches;
	let isPageVisible = document.visibilityState === 'visible';
	let isInView = !config.enableObservation || typeof IntersectionObserver === 'undefined';
	let hasRenderedStatic = false;
	let hasFatalFallback = false;
	let isFallbackVisible = false;
	let isDisposed = false;
	let renderer: Renderer | null = null;
	let deviceProfile = getDeviceProfile();
	let rendererDprCap = getDprCap(deviceProfile);
	let observer: IntersectionObserver | null = null;
	let themeObserver: MutationObserver | null = null;
	let unsubscribeProfile: (() => void) | undefined;

	const currentState = (): State => buildState(config, isMobile, resolveTheme(config.theme, darkQuery));

	const shouldUseStaticFallback = (): boolean => !canUseWebglMotion(deviceProfile) || prefersReducedMotion;

	const applyActivity = (): void => {
		if (renderer && shouldUseStaticFallback()) {
			renderer.dispose();
			renderer = null;
			hasRenderedStatic = false;
			isFallbackVisible = true;
			showFallback(element, canvas, fallback, currentState(), {
				failed: false,
				reason: prefersReducedMotion ? 'reduced-motion' : 'low-tier',
			});
			return;
		}

		maybeMount();
		if (!renderer || isDisposed) return;

		const isActive = canUseWebglMotion(deviceProfile) && isPageVisible && !prefersReducedMotion && (config.enableObservation ? isInView : true);

		if (isActive) {
			hasRenderedStatic = false;
			renderer.start();
			return;
		}

		renderer.stop();
		if (!hasRenderedStatic) {
			renderer.renderOnce();
			hasRenderedStatic = true;
		}
	};

	const applyState = (): void => {
		const nextState = currentState();
		if (isFallbackVisible) {
			showFallback(element, canvas, fallback, nextState, {
				failed: hasFatalFallback,
				reason: element.dataset['fallback'] ?? 'static',
			});
		}
		if (!renderer || isDisposed) return;
		renderer.setState(nextState);
		renderer.resize({ width: nextState.width, height: nextState.height });
		if (!renderer || !canUseWebglMotion(deviceProfile) || prefersReducedMotion) {
			renderer.renderOnce();
			hasRenderedStatic = true;
		}
	};

	const handleFatalContextError = (reason: 'context-lost' | 'context-restored' | 'gl-error'): void => {
		const state = currentState();
		hasFatalFallback = true;
		isFallbackVisible = true;
		renderer?.dispose();
		renderer = null;
		recordWebglDiagnostic({
			feature: 'logo',
			stage: 'runtime',
			result: 'FAIL',
			data: { reason },
		});
		showFallback(element, canvas, fallback, state, {
			failed: true,
			reason,
		});
	};

	const mountRenderer = (): void => {
		const state = currentState();
		hideFallback(element, canvas, fallback);
		isFallbackVisible = false;

		try {
			rendererDprCap = getDprCap(deviceProfile);
			renderer = createRenderer(canvas, state, handleFatalContextError, {
				diagnosticsMode: getWebglDiagnosticsMode(),
				dprCap: rendererDprCap,
			});
			recordWebglDiagnostic({
				feature: 'logo',
				stage: 'mount',
				result: 'SUCCESS',
				data: { deviceTier: deviceProfile.tier },
			});
		} catch (error) {
			recordWebglDiagnostic({
				feature: 'logo',
				stage: 'mount',
				result: 'FAIL',
				data: {
					message: error instanceof Error ? error.message : String(error),
				},
			});
			hasFatalFallback = true;
			isFallbackVisible = true;
			showFallback(element, canvas, fallback, state, {
				failed: true,
				reason: 'init-fail',
			});
			return;
		}

		applyActivity();
	};

	const maybeMount = (): void => {
		if (isDisposed || renderer || hasFatalFallback || !isPageVisible) return;
		if (config.enableObservation && !isInView) return;

		const state = currentState();
		if (shouldUseStaticFallback()) {
			isFallbackVisible = true;
			showFallback(element, canvas, fallback, state, {
				failed: false,
				reason: prefersReducedMotion ? 'reduced-motion' : 'low-tier',
			});
			return;
		}

		mountRenderer();
	};

	const handleMobileChange = (): void => {
		isMobile = mobileQuery.matches;
		applyState();
		applyActivity();
	};

	const handleMotionChange = (): void => {
		prefersReducedMotion = motionQuery.matches;
		if (!prefersReducedMotion && isFallbackVisible && !hasFatalFallback) {
			isFallbackVisible = false;
			hideFallback(element, canvas, fallback);
		}
		applyActivity();
	};

	const handleDeviceProfileChange = (nextProfile: DeviceProfile): void => {
		const previousCanUseWebgl = canUseWebglMotion(deviceProfile);
		const previousDprCap = rendererDprCap;
		deviceProfile = nextProfile;
		const nextDprCap = getDprCap(deviceProfile);

		if (renderer && previousDprCap !== nextDprCap) {
			renderer.dispose();
			renderer = null;
			hasRenderedStatic = false;
			rendererDprCap = nextDprCap;
		}

		if (!previousCanUseWebgl && canUseWebglMotion(deviceProfile) && isFallbackVisible && !hasFatalFallback && !prefersReducedMotion) {
			isFallbackVisible = false;
			hideFallback(element, canvas, fallback);
		}

		applyState();
		applyActivity();
	};

	const handleThemeChange = (): void => {
		applyState();
		applyActivity();
	};

	const handleVisibilityChange = (): void => {
		isPageVisible = document.visibilityState === 'visible';
		applyActivity();
	};

	mobileQuery.addEventListener('change', handleMobileChange);
	motionQuery.addEventListener('change', handleMotionChange);
	darkQuery.addEventListener('change', handleThemeChange);
	document.addEventListener('visibilitychange', handleVisibilityChange);

	if (config.enableObservation && typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver(
			([entry]) => {
				isInView = Boolean(entry?.isIntersecting);
				applyActivity();
			},
			{ rootMargin: '200px', threshold: 0 },
		);
		observer.observe(element);
	}

	themeObserver = new MutationObserver(handleThemeChange);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});

	maybeMount();
	unsubscribeProfile = subscribeDeviceProfile(handleDeviceProfileChange);

	const controller: Controller = {
		dispose: () => {
			if (isDisposed) return;
			isDisposed = true;
			renderer?.dispose();
			renderer = null;
			observer?.disconnect();
			themeObserver?.disconnect();
			mobileQuery.removeEventListener('change', handleMobileChange);
			motionQuery.removeEventListener('change', handleMotionChange);
			darkQuery.removeEventListener('change', handleThemeChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			unsubscribeProfile?.();
			controllers.delete(element);
			activeControllers.delete(controller);
		},
	};

	controllers.set(element, controller);
	activeControllers.add(controller);
	return controller;
};

const setupLogos = (root: ParentNode = document): void => {
	root.querySelectorAll<HTMLElement>(LOGO_SELECTOR).forEach(createController);
};

const disposeLogos = (): void => {
	for (const controller of Array.from(activeControllers)) {
		controller.dispose();
	}
};

setupLogos();

document.addEventListener('astro:page-load', () => setupLogos());
document.addEventListener('astro:before-swap', disposeLogos);
