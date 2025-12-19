type ScrollOptions = {
	lerp?: number;
	wheelMultiplier?: number;
	touchMultiplier?: number;
};

export type ScrollController = {
	start: () => void;
	stop: () => void;
	scrollTo: (target: number) => void;
	destroy: () => void;
};

type VirtualScrollData = {
	deltaX: number;
	deltaY: number;
	event: WheelEvent | TouchEvent;
};

// Convert wheel deltaMode=1 (line-based) into pixels with a consistent baseline.
const LINE_HEIGHT = 100 / 6;
const LISTENER_OPTIONS: AddEventListenerOptions = { passive: false };

const clamp = (min: number, value: number, max: number) => Math.max(min, Math.min(value, max));

const damp = (current: number, target: number, lambda: number, deltaTime: number) => {
	const t = 1 - Math.exp(-lambda * deltaTime);
	return current + (target - current) * t;
};

class Dimensions {
	private wrapper: Window;
	private content: HTMLElement;

	width = 0;
	height = 0;
	scrollHeight = 0;

	constructor(wrapper: Window, content: HTMLElement) {
		this.wrapper = wrapper;
		this.content = content;
		this.resize();
	}

	destroy() {}

	resize() {
		this.width = this.wrapper.innerWidth;
		this.height = this.wrapper.innerHeight;
		this.scrollHeight = this.content.scrollHeight;
	}

	get limit() {
		return Math.max(0, this.scrollHeight - this.height);
	}
}

class VirtualScroll {
	private element: HTMLElement;
	private options: { wheelMultiplier: number; touchMultiplier: number };
	private onScroll: (data: VirtualScrollData) => void;
	private touchStart = { x: 0, y: 0 };
	private windowSize = { width: 0, height: 0 };

	constructor(element: HTMLElement, options: { wheelMultiplier: number; touchMultiplier: number }, onScroll: (data: VirtualScrollData) => void) {
		this.element = element;
		this.options = options;
		this.onScroll = onScroll;

		this.handleWindowResize();
		window.addEventListener('resize', this.handleWindowResize, false);

		this.element.addEventListener('wheel', this.handleWheel, LISTENER_OPTIONS);
		this.element.addEventListener('touchstart', this.handleTouchStart, LISTENER_OPTIONS);
		this.element.addEventListener('touchmove', this.handleTouchMove, LISTENER_OPTIONS);
		this.element.addEventListener('touchend', this.handleTouchEnd, LISTENER_OPTIONS);
	}

	destroy() {
		window.removeEventListener('resize', this.handleWindowResize, false);
		this.element.removeEventListener('wheel', this.handleWheel, LISTENER_OPTIONS);
		this.element.removeEventListener('touchstart', this.handleTouchStart, LISTENER_OPTIONS);
		this.element.removeEventListener('touchmove', this.handleTouchMove, LISTENER_OPTIONS);
		this.element.removeEventListener('touchend', this.handleTouchEnd, LISTENER_OPTIONS);
	}

	private handleWindowResize = () => {
		this.windowSize = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
	};

	private handleWheel = (event: WheelEvent) => {
		let { deltaX, deltaY, deltaMode } = event;

		const multiplierX = deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? this.windowSize.width : 1;
		const multiplierY = deltaMode === 1 ? LINE_HEIGHT : deltaMode === 2 ? this.windowSize.height : 1;

		deltaX *= multiplierX * this.options.wheelMultiplier;
		deltaY *= multiplierY * this.options.wheelMultiplier;

		this.onScroll({ deltaX, deltaY, event });
	};

	private handleTouchStart = (event: TouchEvent) => {
		const touch = event.targetTouches[0];
		if (!touch) return;

		this.touchStart.x = touch.clientX;
		this.touchStart.y = touch.clientY;

		this.onScroll({ deltaX: 0, deltaY: 0, event });
	};

	private handleTouchMove = (event: TouchEvent) => {
		const touch = event.targetTouches[0];
		if (!touch) return;

		const deltaX = -(touch.clientX - this.touchStart.x) * this.options.touchMultiplier;
		const deltaY = -(touch.clientY - this.touchStart.y) * this.options.touchMultiplier;

		this.touchStart.x = touch.clientX;
		this.touchStart.y = touch.clientY;

		this.onScroll({ deltaX, deltaY, event });
	};

	private handleTouchEnd = (event: TouchEvent) => {
		this.onScroll({ deltaX: 0, deltaY: 0, event });
	};
}

export const createScroll = (options: ScrollOptions = {}): ScrollController => {
	const root = document.documentElement;
	const wrapper = window;
	const content = document.documentElement;
	const lerp = options.lerp ?? 0.05;
	const wheelMultiplier = options.wheelMultiplier ?? 1;
	const touchMultiplier = options.touchMultiplier ?? 1;

	const dimensions = new Dimensions(wrapper, content);

	let targetScroll = wrapper.scrollY;
	let animatedScroll = targetScroll;
	let lastTime = 0;
	let rafId: number | null = null;
	let isStopped = false;
	let preventNextNative = false;
	let contentResizeObserver: ResizeObserver | null = null;
	let pendingDelta = 0;

	const updateClasses = () => {
		root.classList.add('scroll');
		root.classList.toggle('scroll-smooth', !isStopped);
		root.classList.toggle('scroll-stopped', isStopped);
	};

	const setScroll = (value: number) => {
		preventNextNative = true;
		wrapper.scrollTo({ top: value, behavior: 'instant' });
		requestAnimationFrame(() => {
			preventNextNative = false;
		});
	};

	const handleNativeScroll = () => {
		if (preventNextNative) return;
		animatedScroll = wrapper.scrollY;
		targetScroll = animatedScroll;
	};

	const handleResize = () => {
		dimensions.resize();
		targetScroll = clamp(0, targetScroll, dimensions.limit);
		animatedScroll = clamp(0, animatedScroll, dimensions.limit);
		setScroll(animatedScroll);
	};

	const applyDelta = (delta: number) => {
		if (dimensions.limit <= 0) return;
		targetScroll = clamp(0, targetScroll + delta, dimensions.limit);
	};

	const handleVirtualScroll = ({ deltaX, deltaY, event }: VirtualScrollData) => {
		if (isStopped) return;
		if (event.ctrlKey) return;
		if (dimensions.limit <= 0) return;

		// Nested scroll prevention would be handled here, but is skipped to keep scope minimal.

		if (event.cancelable) {
			event.preventDefault();
		}

		const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
		if (delta === 0) return;
		pendingDelta += delta;
	};

	const virtualScroll = new VirtualScroll(content, { wheelMultiplier, touchMultiplier }, handleVirtualScroll);

	const tick = (time: number) => {
		if (lastTime === 0) {
			lastTime = time;
			rafId = requestAnimationFrame(tick);
			return;
		}

		const deltaTime = (time - lastTime) / 1000;
		lastTime = time;

		if (pendingDelta !== 0) {
			applyDelta(pendingDelta);
			pendingDelta = 0;
		}

		if (!isStopped) {
			// Scale lerp for 60fps to keep easing consistent across refresh rates.
			const next = damp(animatedScroll, targetScroll, lerp * 60, deltaTime);
			const diff = Math.abs(next - targetScroll);
			animatedScroll = diff < 0.1 ? targetScroll : next;
			if (Math.abs(animatedScroll - wrapper.scrollY) > 0.1) {
				setScroll(animatedScroll);
			}
		}

		rafId = requestAnimationFrame(tick);
	};

	const start = () => {
		if (!isStopped) return;
		isStopped = false;
		updateClasses();
	};

	const stop = () => {
		if (isStopped) return;
		isStopped = true;
		updateClasses();
	};

	const scrollTo = (target: number) => {
		targetScroll = clamp(0, target, dimensions.limit);
	};

	const destroy = () => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}
		rafId = null;
		contentResizeObserver?.disconnect();
		contentResizeObserver = null;
		virtualScroll.destroy();
		dimensions.destroy();
		wrapper.removeEventListener('scroll', handleNativeScroll, false);
		wrapper.removeEventListener('resize', handleResize, false);
		root.classList.remove('scroll', 'scroll-smooth', 'scroll-stopped');
	};

	wrapper.addEventListener('scroll', handleNativeScroll, false);
	wrapper.addEventListener('resize', handleResize, false);
	if (typeof ResizeObserver !== 'undefined') {
		contentResizeObserver = new ResizeObserver(() => handleResize());
		contentResizeObserver.observe(content);
	}
	updateClasses();
	rafId = requestAnimationFrame(tick);

	return {
		start,
		stop,
		scrollTo,
		destroy,
	};
};
