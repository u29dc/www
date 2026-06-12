import { AppOwner, type Context, type Frame } from '../core/owner';
import { clamp, damp } from '../utils/math';
import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from './device';
import { onRouteAfterSwap, onRouteLoad } from './route';

type ScrollSource = 'wheel' | 'anchor' | 'route' | 'native';
type ScrollDirection = -1 | 0 | 1;
type ScrollStateSnapshot = {
	actual: number;
	animated: number;
	target: number;
	velocity: number;
	direction: ScrollDirection;
	limit: number;
	active: boolean;
	source: ScrollSource;
	enabled: boolean;
};

type AnimatorOptions = {
	lerp: number;
	settlePx: number;
};

const ENABLE_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SCROLL_LERP = 0.1;
const SETTLE_PX = 0.5;
const LINE_HEIGHT = 100 / 6;
const PAGE_RATIO = 0.9;
const NATIVE_SCROLL_SELECTOR = '[data-native-scroll], [data-scroll-native], textarea, select, iframe';

class ScrollOwner extends AppOwner {
	readonly name = 'scroll';
	override readonly order = 30;

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
	private writeY: number | undefined;
	private wake: (reason?: string) => void = () => {};
	private sleep: () => void = () => {};
	private readonly enableQuery = window.matchMedia(ENABLE_QUERY);
	private readonly reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	private readonly animator = new ScrollAnimator({ lerp: SCROLL_LERP, settlePx: SETTLE_PX });

	override preinit(context: Context): void {
		super.preinit(context);
		this.wake = context.wake;
		this.sleep = context.sleep;
		this.bind();
	}

	init(): void {
		this.syncFromWindow('route');
		this.applyCapability();
	}

	resize(): void {
		this.measureLimit();
		this.clampModelToLimit();
	}

	update(frame: Frame): void | false {
		if (!this.active || !frame.visible) {
			this.sleep();
			return;
		}

		this.animator.retarget(this.target);
		const done = this.animator.advance(frame.dt);
		this.animated = this.animator.value;
		this.velocity = this.animator.velocity;
		this.direction = Math.sign(this.velocity) as ScrollDirection;
		this.writeY = this.animated;

		if (done) {
			this.active = false;
			this.source = 'native';
		}
	}

	write(): void {
		if (this.writeY === undefined) return;

		const y = this.writeY;
		this.writeY = undefined;
		this.actual = y;
		if (Math.abs(window.scrollY - y) <= 0.1) return;

		this.programmatic = true;
		window.scrollTo(0, y);
	}

	post(): void {
		if (this.active) return;
		this.programmatic = false;
		this.source = 'native';
		this.sleep();
	}

	override dispose(): void {
		super.dispose();
		this.syncFromWindow('native');
	}

	getState(): ScrollStateSnapshot {
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
		window.addEventListener('wheel', this.handleWheel, { passive: false });
		this.addCleanup(() => window.removeEventListener('wheel', this.handleWheel));
		window.addEventListener('scroll', this.handleNativeScroll, { passive: true });
		this.addCleanup(() => window.removeEventListener('scroll', this.handleNativeScroll));
		window.addEventListener('keydown', this.handleInterrupt, { passive: true });
		this.addCleanup(() => window.removeEventListener('keydown', this.handleInterrupt));
		window.addEventListener('pointerdown', this.handleInterrupt, { passive: true });
		this.addCleanup(() => window.removeEventListener('pointerdown', this.handleInterrupt));
		this.enableQuery.addEventListener('change', this.applyCapability);
		this.addCleanup(() => this.enableQuery.removeEventListener('change', this.applyCapability));
		this.reduceMotionQuery.addEventListener('change', this.applyCapability);
		this.addCleanup(() => this.reduceMotionQuery.removeEventListener('change', this.applyCapability));
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
		this.writeY = undefined;
		this.programmatic = false;
		this.animator.sync(y);
		this.sleep();
	}

	private shouldEnhance(): boolean {
		const profile = getDeviceProfile();
		return (
			this.enableQuery.matches &&
			!this.reduceMotionQuery.matches &&
			profile.motionQuality !== 'reduced' &&
			profile.inputProfile !== 'coarse' &&
			profile.displayProfile !== 'small' &&
			profile.networkProfile !== 'save-data' &&
			profile.tier !== 'low'
		);
	}

	private readonly applyCapability = (): void => {
		this.enabled = this.shouldEnhance();
		document.documentElement.dataset['smoothScroll'] = this.enabled ? 'enhanced' : 'native';
		if (!this.enabled) this.syncFromWindow('native');
	};

	private startWheelScroll(deltaY: number): void {
		this.measureLimit();
		if (!this.active) {
			const y = clamp(window.scrollY, 0, this.limit);
			this.actual = y;
			this.animated = y;
			this.target = y;
			this.animator.sync(y);
		}

		this.target = clamp(this.target + deltaY, 0, this.limit);
		this.source = 'wheel';
		this.active = true;
		this.animator.retarget(this.target);
		this.wake('scroll:wheel');
	}

	private readonly handleWheel = (event: WheelEvent): void => {
		if (shouldUseNativeWheel(event, this.enabled)) return;

		event.preventDefault();
		this.startWheelScroll(normalizeWheelDeltaY(event));
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

const normalizeWheelDeltaY = (event: WheelEvent): number => {
	if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_HEIGHT;
	if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight * PAGE_RATIO;
	return event.deltaY;
};

const shouldUseNativeWheel = (event: WheelEvent, enabled: boolean): boolean => {
	if (!enabled || event.defaultPrevented) return true;
	if (event.ctrlKey || event.metaKey || event.shiftKey) return true;
	if (!(event.target instanceof Element)) return false;
	return Boolean(event.target.closest(NATIVE_SCROLL_SELECTOR));
};

export const scroll = new ScrollOwner();
export const getScrollState = (): ScrollStateSnapshot => scroll.getState();
