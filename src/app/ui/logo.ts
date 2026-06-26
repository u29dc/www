import { BaseModule, type Context, type Frame } from '../core/module';
import type { DeviceProfile } from '../core/state';
import { createRenderer, getWebglDiagnosticsMode, recordWebglDiagnostic, type Renderer, type State, type Theme } from '../graphics/canvas';
import { canUseWebglMotion, getDeviceProfile, getDprCap, initDeviceProfile } from '../systems/device';
import { onRouteBeforeSwap } from '../systems/route';

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
	update: (frame: Frame) => boolean;
	resize: () => void;
	dispose: () => void;
};

const LOGO_SELECTOR = '[data-logo]';
const MOBILE_WIDTH_PX = 767;

class LogoOwner extends BaseModule {
	readonly name = 'logo';

	private readonly controllers = new WeakMap<HTMLElement, Controller>();
	private readonly activeControllers = new Set<Controller>();
	private initialized = false;

	override preinit(context: Context): void {
		super.preinit(context);
		this.bind();
	}

	override init(): void {
		this.setupLogos();
	}

	override refresh(): void {
		this.setupLogos();
	}

	override resize(): void {
		for (const controller of this.activeControllers) controller.resize();
		this.requestFrame('logo:resize');
	}

	override update(frame: Frame): boolean | void {
		let needsNextFrame = false;
		for (const controller of this.activeControllers) {
			needsNextFrame = controller.update(frame) || needsNextFrame;
		}
		return needsNextFrame;
	}

	override dispose(): void {
		super.dispose();
		this.disposeLogos();
		this.initialized = false;
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		this.addCleanup(onRouteBeforeSwap(() => this.disposeLogos()));
	}

	private setupLogos(root: ParentNode = document): void {
		root.querySelectorAll<HTMLElement>(LOGO_SELECTOR).forEach((element) => this.createController(element));
	}

	private disposeLogos(): void {
		for (const controller of Array.from(this.activeControllers)) {
			controller.dispose();
		}
	}

	private createController(element: HTMLElement): Controller | undefined {
		if (this.controllers.has(element)) return undefined;

		const canvas = element.querySelector<HTMLCanvasElement>('[data-logo-canvas]');
		const fallback = element.querySelector<HTMLElement>('[data-logo-fallback]');
		if (!canvas || !fallback) return undefined;

		const config = readConfig(element);
		let isMobile = readIsMobile();
		let prefersReducedMotion = getDeviceProfile().motionQuality === 'reduced';
		let isPageVisible = document.visibilityState === 'visible';
		let isInView = !config.enableObservation || typeof IntersectionObserver === 'undefined';
		let hasRenderedStatic = false;
		let hasFatalFallback = false;
		let isFallbackVisible = false;
		let isDisposed = false;
		let renderer: Renderer | null = null;
		let deviceProfile = getDeviceProfile();
		let rendererDprCap = getDprCap(deviceProfile);
		let activeTheme: Theme = resolveTheme(config.theme, readDocumentTheme());
		let activeStateKey = '';
		let activeCapabilityKey = '';
		let observer: IntersectionObserver | null = null;

		const currentState = (): State => buildState(config, isMobile, activeTheme);

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
			const nextStateKey = JSON.stringify(nextState);
			if (nextStateKey === activeStateKey) return;
			activeStateKey = nextStateKey;
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
			const state = currentState();
			if (shouldUseStaticFallback()) {
				isFallbackVisible = true;
				showFallback(element, canvas, fallback, state, {
					failed: false,
					reason: prefersReducedMotion ? 'reduced-motion' : 'low-tier',
				});
				return;
			}
			if (config.enableObservation && !isInView) return;

			mountRenderer();
		};

		const applyDeviceProfile = (nextProfile: DeviceProfile): void => {
			const previousCanUseWebgl = canUseWebglMotion(deviceProfile);
			const previousDprCap = rendererDprCap;
			deviceProfile = nextProfile;
			prefersReducedMotion = deviceProfile.motionQuality === 'reduced';
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

		const applyTheme = (theme: Theme): void => {
			activeTheme = theme;
			applyState();
			applyActivity();
		};

		const applyMobile = (mobile: boolean): void => {
			isMobile = mobile;
			applyState();
			applyActivity();
		};

		const applyVisibility = (visible: boolean): void => {
			isPageVisible = visible;
			applyActivity();
		};

		if (config.enableObservation && typeof IntersectionObserver !== 'undefined') {
			observer = new IntersectionObserver(
				([entry]) => {
					isInView = Boolean(entry?.isIntersecting);
					applyActivity();
					this.requestFrame('logo:intersection');
				},
				{ rootMargin: '200px', threshold: 0 },
			);
			observer.observe(element);
		}

		maybeMount();

		const controller: Controller = {
			update: (frame) => {
				const nextTheme = resolveTheme(config.theme, frame.theme.scheme);
				const nextMobile = frame.profile.signals.viewportWidth <= MOBILE_WIDTH_PX;
				const nextCapabilityKey = [frame.profile.generation, frame.visible ? 'visible' : 'hidden', isInView ? 'in-view' : 'out-of-view', nextMobile ? 'mobile' : 'desktop', nextTheme].join(
					':',
				);

				if (nextCapabilityKey !== activeCapabilityKey) {
					activeCapabilityKey = nextCapabilityKey;
					applyDeviceProfile(frame.profile);
					applyTheme(nextTheme);
					applyMobile(nextMobile);
					applyVisibility(frame.visible);
				}

				if (renderer && canUseWebglMotion(deviceProfile) && !prefersReducedMotion && frame.input.pointer.path.includes(element)) {
					renderer.setPointer(frame.input.pointer.x, frame.input.pointer.y);
				}

				return renderer?.update(frame.now, frame.dt) ?? false;
			},
			resize: () => {
				applyMobile(readIsMobile());
				renderer?.resize({ width: currentState().width, height: currentState().height });
			},
			dispose: () => {
				if (isDisposed) return;
				isDisposed = true;
				renderer?.dispose();
				renderer = null;
				observer?.disconnect();
				this.controllers.delete(element);
				this.activeControllers.delete(controller);
			},
		};

		this.controllers.set(element, controller);
		this.activeControllers.add(controller);
		return controller;
	}
}

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

const resolveTheme = (preference: ThemePreference, scheme: Theme): Theme => {
	if (preference === 'light' || preference === 'dark') return preference;

	const rootTheme = document.documentElement.dataset['theme'];
	if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;

	return scheme;
};

const readDocumentTheme = (): Theme => {
	const rootTheme = document.documentElement.dataset['theme'];
	if (rootTheme === 'light' || rootTheme === 'dark') return rootTheme;
	return 'light';
};

const readIsMobile = (): boolean => window.innerWidth <= MOBILE_WIDTH_PX;

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

export const logo = new LogoOwner();
