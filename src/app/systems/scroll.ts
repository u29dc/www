import { BaseModule, type Context, type Frame } from '../core/module';
import type { ScrollDirection, ScrollSource, ScrollState } from '../core/state';
import { focusElement, pathClosest } from '../utils/dom';
import { clamp, damp } from '../utils/math';
import { initDeviceProfile, subscribeDeviceProfile } from './device';
import { type InputClickIntent, type InputWheelIntent, onInputClickIntent, onInputWheelIntent } from './input';
import { onRouteAfterSwap, onRouteLoad, setRouteHash } from './route';

type AnimatorOptions = {
	lerp: number;
	settlePx: number;
};

const SCROLL_LERP = 0.1;
const SETTLE_PX = 0.5;
const NATIVE_SCROLL_SELECTOR = '[data-native-scroll], [data-scroll-native], textarea, select, iframe, [contenteditable=""], [contenteditable="true"]';

class ScrollOwner extends BaseModule {
	readonly name = 'scroll';

	private initialized = false;
	private enabled = false;
	private active = false;
	private source: ScrollSource = 'native';
	private actual = 0;
	private animated = 0;
	private target = 0;
	private velocity = 0;
	private direction: ScrollDirection = 0;
	private limit = 0;
	private programmatic = false;
	private readonly animator = new ScrollAnimator({ lerp: SCROLL_LERP, settlePx: SETTLE_PX });

	override preinit(context: Context): void {
		super.preinit(context);
		this.bind();
	}

	override init(): void {
		this.syncFromWindow('route');
		this.applyCapability();
	}

	override resize(): void {
		this.measureLimit();
		this.clampModelToLimit();
	}

	override update(frame: Frame): boolean | void {
		if (frame.input.pointer.wasPressed || frame.input.keyboard.hadKeyboardInput) {
			this.handleInterrupt();
		}

		if (!this.active || !frame.visible) {
			return false;
		}

		this.animator.retarget(this.target);
		const done = this.animator.advance(frame.dt);
		this.animated = this.animator.value;
		this.velocity = this.animator.velocity;
		this.direction = Math.sign(this.velocity) as ScrollDirection;

		if (done) {
			this.active = false;
			this.source = 'native';
		}

		this.actual = this.animated;
		if (Math.abs(window.scrollY - this.animated) > 0.1) {
			this.programmatic = true;
			window.scrollTo(0, this.animated);
		}

		if (this.active) return true;
		this.programmatic = false;
		this.source = 'native';
		return false;
	}

	override dispose(): void {
		super.dispose();
		this.syncFromWindow('native');
	}

	getState(): ScrollState {
		return {
			actual: this.actual,
			animated: this.animated,
			target: this.target,
			velocity: this.velocity,
			direction: this.direction,
			limit: this.limit,
			active: this.active,
			source: this.source,
			enabled: this.enabled,
		};
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		window.addEventListener('scroll', this.handleNativeScroll, { passive: true });
		this.addCleanup(() => window.removeEventListener('scroll', this.handleNativeScroll));
		this.addCleanup(onInputWheelIntent(this.handleWheelIntent));
		this.addCleanup(onInputClickIntent(this.handleClickIntent));
		this.addCleanup(subscribeDeviceProfile(this.applyCapability));
		this.addCleanup(onRouteAfterSwap(this.handleRouteSync));
		this.addCleanup(onRouteLoad(this.handleRouteSync));
		this.applyCapability();
	}

	private readLimit(): number {
		const body = document.body;
		const root = document.documentElement;
		return Math.max(0, Math.max(body.scrollHeight, root.scrollHeight) - window.innerHeight);
	}

	private measureLimit(): void {
		this.limit = this.readLimit();
	}

	private clampModelToLimit(): void {
		this.actual = clamp(this.actual, 0, this.limit);
		this.animated = clamp(this.animated, 0, this.limit);
		this.target = clamp(this.target, 0, this.limit);
		this.animator.start(this.animated, this.target);
		if (this.animated === this.target) {
			this.animator.stop();
		}
	}

	private syncFromWindow(source: ScrollSource): void {
		this.measureLimit();
		const y = clamp(window.scrollY, 0, this.limit);
		this.actual = y;
		this.animated = y;
		this.target = y;
		this.velocity = 0;
		this.direction = 0;
		this.source = source;
		this.active = false;
		this.programmatic = false;
		this.animator.sync(y);
	}

	private shouldEnhance(frameProfile = this.context?.profile): boolean {
		const profile = frameProfile;
		if (!profile) return false;
		return (
			profile.signals.hover &&
			profile.motionQuality !== 'reduced' &&
			profile.inputProfile !== 'coarse' &&
			profile.inputProfile !== 'unknown' &&
			profile.displayProfile !== 'small' &&
			profile.networkProfile !== 'save-data' &&
			profile.tier !== 'low'
		);
	}

	private readonly applyCapability = (): void => {
		this.enabled = this.shouldEnhance();
		document.documentElement.dataset['smoothScroll'] = this.enabled ? 'enhanced' : 'native';
		if (!this.enabled) this.syncFromWindow('native');
		this.requestFrame('scroll:capability');
	};

	private startScroll(deltaY: number, source: ScrollSource): void {
		this.measureLimit();
		if (!this.active) {
			const y = clamp(window.scrollY, 0, this.limit);
			this.actual = y;
			this.animated = y;
			this.target = y;
			this.animator.sync(y);
		}

		this.target = clamp(this.target + deltaY, 0, this.limit);
		this.source = source;
		this.active = true;
		this.animator.retarget(this.target);
		this.requestFrame(`scroll:${source}`);
	}

	private scrollTo(y: number, source: ScrollSource): void {
		this.measureLimit();
		const target = clamp(y, 0, this.limit);
		if (!this.enabled) {
			window.scrollTo(0, target);
			this.syncFromWindow(source);
			return;
		}

		const current = clamp(window.scrollY, 0, this.limit);
		this.actual = current;
		this.animated = current;
		this.target = target;
		this.source = source;
		this.active = true;
		this.animator.start(current, target);
		this.requestFrame(`scroll:${source}`);
	}

	private readonly handleWheelIntent = (intent: InputWheelIntent): void => {
		if (shouldUseNativeWheel(intent, this.enabled)) return;

		intent.preventDefault();
		this.startScroll(intent.dy, 'wheel');
	};

	private readonly handleClickIntent = (intent: InputClickIntent): void => {
		if (!intent.isPrimary || intent.defaultPrevented || intent.isModified) return;
		const anchor = pathClosest<HTMLAnchorElement>(intent.path, 'a[href]');
		if (!anchor || anchor.target || anchor.download) return;
		const url = new URL(anchor.href, window.location.href);
		if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) return;
		const target = findAnchorTarget(url.hash);
		if (!target) return;

		intent.preventDefault();
		const y = target === document.documentElement ? 0 : target.getBoundingClientRect().top + window.scrollY;
		this.scrollTo(y, 'anchor');
		setRouteHash(url.hash);
		focusElement(target);
	};

	private readonly handleNativeScroll = (): void => {
		if (this.programmatic) {
			if (Math.abs(window.scrollY - this.animated) > 2) {
				this.programmatic = false;
				this.syncFromWindow('native');
				return;
			}
			this.programmatic = false;
			return;
		}
		this.syncFromWindow('native');
	};

	private readonly handleInterrupt = (): void => {
		if (!this.active) return;
		this.syncFromWindow('native');
	};

	private readonly handleRouteSync = (): void => {
		this.syncFromWindow('route');
		this.applyCapability();
	};
}

class ScrollAnimator {
	value = 0;
	target = 0;
	velocity = 0;
	running = false;

	private readonly lerp: number;
	private readonly settlePx: number;

	constructor(options: AnimatorOptions) {
		this.lerp = options.lerp;
		this.settlePx = options.settlePx;
	}

	sync(value: number): void {
		this.value = value;
		this.target = value;
		this.velocity = 0;
		this.running = false;
	}

	start(from: number, to: number): void {
		this.value = from;
		this.target = to;
		this.velocity = 0;
		this.running = true;
	}

	retarget(to: number): void {
		this.target = to;
		this.running = true;
	}

	advance(dt: number): boolean {
		if (!this.running) return true;

		const previous = this.value;
		this.value = damp(this.value, this.target, this.lerp * 60, dt);
		this.velocity = dt > 0 ? (this.value - previous) / dt : 0;

		const settled = Math.abs(this.target - this.value) <= this.settlePx && Math.abs(this.velocity) <= this.settlePx * 120;
		if (settled) {
			this.value = this.target;
			this.velocity = 0;
			this.running = false;
			return true;
		}

		return false;
	}

	stop(): void {
		this.running = false;
		this.velocity = 0;
	}
}

const shouldUseNativeWheel = (intent: InputWheelIntent, enabled: boolean): boolean => {
	if (!enabled || intent.defaultPrevented) return true;
	if (intent.ctrlKey || intent.metaKey || intent.shiftKey) return true;
	return Boolean(pathClosest<Element>(intent.path, NATIVE_SCROLL_SELECTOR));
};

const findAnchorTarget = (hash: string): HTMLElement | undefined => {
	if (hash === '#top') return document.documentElement;
	const id = decodeURIComponent(hash.slice(1));
	if (!id) return document.documentElement;
	const target = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[name="${CSS.escape(id)}"]`);
	return target instanceof HTMLElement ? target : undefined;
};

export const scroll = new ScrollOwner();
export const getScrollState = (): ScrollState => scroll.getState();
