import { createAtomicBrandLogoRenderer, evaluateAtomicBrandLogoPolicy, type AtomicBrandLogoRenderer, type AtomicBrandLogoState, type AtomicBrandLogoTheme } from '../lib/atomic-brand-logo';
import { recordWebglDiagnostic, type DeviceTier } from '../lib/webgl';

type LogoThemePreference = AtomicBrandLogoTheme | 'system';

type AtomicBrandLogoConfig = {
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
	animateNoise: boolean;
	theme: LogoThemePreference;
	enableObservation: boolean;
};

type LogoController = {
	dispose: () => void;
};

const LOGO_SELECTOR = '[data-atomic-brand-logo]';
const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const controllers = new WeakMap<HTMLElement, LogoController>();
const activeControllers = new Set<LogoController>();

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

const parseTheme = (value: string | undefined): LogoThemePreference => {
	if (value === 'light' || value === 'dark') return value;
	return 'system';
};

const readConfig = (element: HTMLElement): AtomicBrandLogoConfig => {
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
		animateNoise: parseBoolean(element.dataset['animateNoise'], false),
		theme: parseTheme(element.dataset['theme']),
		enableObservation: parseBoolean(element.dataset['enableObservation'], true),
	};
};

const resolveTheme = (preference: LogoThemePreference, darkQuery: MediaQueryList): AtomicBrandLogoTheme => {
	if (preference === 'light' || preference === 'dark') return preference;

	const rootTheme = document.documentElement.dataset['theme'];
	if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;

	return darkQuery.matches ? 'dark' : 'light';
};

const buildState = (config: AtomicBrandLogoConfig, isMobile: boolean, theme: AtomicBrandLogoTheme): AtomicBrandLogoState => {
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
		animateNoise: config.animateNoise,
		theme,
	};
};

const showFallback = (element: HTMLElement, canvas: HTMLCanvasElement, fallback: HTMLElement, state: AtomicBrandLogoState): void => {
	canvas.hidden = true;
	fallback.hidden = false;
	fallback.style.fontSize = `${Math.max(state.width * 0.16, 16)}px`;
	fallback.dataset['theme'] = state.theme;
	element.dataset['atomicBrandLogoFailed'] = 'true';
};

const createController = (element: HTMLElement): LogoController | undefined => {
	if (controllers.has(element)) return undefined;

	const canvas = element.querySelector<HTMLCanvasElement>('[data-atomic-brand-logo-canvas]');
	const fallback = element.querySelector<HTMLElement>('[data-atomic-brand-logo-fallback]');
	if (!canvas || !fallback) return undefined;

	const config = readConfig(element);
	const mobileQuery = window.matchMedia(MOBILE_QUERY);
	const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	const darkQuery = window.matchMedia(DARK_QUERY);

	let isMobile = mobileQuery.matches;
	let prefersReducedMotion = motionQuery.matches;
	let isPageVisible = document.visibilityState === 'visible';
	let isInView = true;
	let hasRenderedStatic = false;
	let isDisposed = false;
	let renderer: AtomicBrandLogoRenderer | null = null;
	let deviceTier: DeviceTier = 'high';
	let observer: IntersectionObserver | null = null;
	let themeObserver: MutationObserver | null = null;

	const currentState = (): AtomicBrandLogoState => buildState(config, isMobile, resolveTheme(config.theme, darkQuery));

	const applyActivity = (): void => {
		if (!renderer || isDisposed) return;

		const isActive = deviceTier !== 'low' && isPageVisible && !prefersReducedMotion && (config.enableObservation ? isInView : true);

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
		if (!renderer || isDisposed) return;
		const nextState = currentState();
		renderer.setState(nextState);
		renderer.resize({ width: nextState.width, height: nextState.height });
		if (!renderer || deviceTier === 'low' || prefersReducedMotion) {
			renderer.renderOnce();
			hasRenderedStatic = true;
		}
	};

	const handleFatalContextError = (reason: 'context-lost' | 'context-restored' | 'gl-error'): void => {
		const state = currentState();
		renderer?.dispose();
		renderer = null;
		recordWebglDiagnostic({
			feature: 'atomic-logo',
			stage: 'runtime',
			result: 'FAIL',
			data: { reason },
		});
		showFallback(element, canvas, fallback, state);
	};

	const mount = (): void => {
		deviceTier = evaluateAtomicBrandLogoPolicy(config.enableObservation);
		const state = currentState();

		try {
			renderer = createAtomicBrandLogoRenderer(canvas, state, handleFatalContextError);
			recordWebglDiagnostic({
				feature: 'atomic-logo',
				stage: 'mount',
				result: 'SUCCESS',
				data: { deviceTier },
			});
		} catch (error) {
			recordWebglDiagnostic({
				feature: 'atomic-logo',
				stage: 'mount',
				result: 'FAIL',
				data: {
					message: error instanceof Error ? error.message : String(error),
				},
			});
			showFallback(element, canvas, fallback, state);
			return;
		}

		applyActivity();
	};

	const handleMobileChange = (): void => {
		isMobile = mobileQuery.matches;
		applyState();
		applyActivity();
	};

	const handleMotionChange = (): void => {
		prefersReducedMotion = motionQuery.matches;
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

	mount();

	const controller: LogoController = {
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
			activeControllers.delete(controller);
		},
	};

	controllers.set(element, controller);
	activeControllers.add(controller);
	return controller;
};

const setupAtomicBrandLogos = (root: ParentNode = document): void => {
	root.querySelectorAll<HTMLElement>(LOGO_SELECTOR).forEach(createController);
};

const disposeAtomicBrandLogos = (): void => {
	for (const controller of Array.from(activeControllers)) {
		controller.dispose();
	}
};

setupAtomicBrandLogos();

document.addEventListener('astro:page-load', () => setupAtomicBrandLogos());
document.addEventListener('astro:before-swap', disposeAtomicBrandLogos);
