// Small browser boundary for exercising the real owners without a browser or network.
export class ElementStub extends EventTarget {
	constructor(tagName = 'div', attributes = {}) {
		super();
		this.tagName = tagName.toUpperCase();
		this.attributes = new Map(Object.entries(attributes));
		this.dataset = {};
		this.isConnected = true;
		this.scrollHeight = 3000;
		this.style = {
			setProperty() {},
			getPropertyValue: () => '',
		};
	}

	getAttribute(name) {
		return this.attributes.get(name) ?? null;
	}

	hasAttribute(name) {
		return this.attributes.has(name);
	}

	setAttribute(name, value) {
		this.attributes.set(name, value);
	}

	removeAttribute(name) {
		this.attributes.delete(name);
	}

	closest(selector) {
		if (selector === 'a[href]' && this.tagName === 'A' && this.href) return this;
		if (selector.includes('data-native-scroll') && this.hasAttribute('data-native-scroll')) return this;
		return null;
	}

	matches() {
		return false;
	}

	focus(options) {
		this.focusOptions = options;
	}
}

class DocumentStub extends EventTarget {
	documentElement = new ElementStub('html');
	body = new ElementStub('body');
	visibilityState = 'visible';
	hidden = false;
	targets = new Map();
	reveals = [];

	constructor() {
		super();
		this.documentElement.ownerDocument = this;
	}

	getElementById(id) {
		return this.targets.get(id) ?? null;
	}

	querySelector() {
		return null;
	}

	querySelectorAll() {
		return this.reveals;
	}
}

class WheelStub extends Event {
	static DOM_DELTA_LINE = 1;
	static DOM_DELTA_PAGE = 2;
}

export const event = (type, properties = {}) => {
	const value = new Event(type, { cancelable: true });
	for (const [key, property] of Object.entries(properties)) Object.defineProperty(value, key, { value: property, configurable: true, writable: true });
	return value;
};

export const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((fulfill, fail) => {
		resolve = fulfill;
		reject = fail;
	});
	return { promise, resolve, reject };
};

export const installBrowser = (pathname = '/lotus', options = {}) => {
	const document = new DocumentStub();
	const window = new EventTarget();
	const historyWrites = [];
	const intersections = [];
	Object.assign(window, {
		location: new URL(pathname, 'https://example.test'),
		innerWidth: options.width ?? 1440,
		innerHeight: 800,
		devicePixelRatio: 1,
		scrollY: 0,
		setTimeout,
		clearTimeout,
		matchMedia(query) {
			return Object.assign(new EventTarget(), {
				matches: query.includes('reduced-motion') ? (options.reducedMotion ?? false) : query === '(hover: hover)' || query.includes('pointer: fine'),
			});
		},
		scrollTo(_x, y) {
			this.scrollY = y;
		},
		history: {
			state: { index: 4, scrollX: 0, scrollY: 0 },
			pushState(...args) {
				historyWrites.push(['push', ...args]);
			},
			replaceState(...args) {
				historyWrites.push(['replace', ...args]);
			},
		},
	});
	class IntersectionStub {
		constructor(callback) {
			this.callback = callback;
			this.targets = new Set();
			intersections.push(this);
		}
		observe(target) {
			this.targets.add(target);
		}
		unobserve(target) {
			this.targets.delete(target);
		}
		disconnect() {
			this.targets.clear();
		}
	}
	const globals = {
		window,
		document,
		Document: DocumentStub,
		Node: ElementStub,
		Element: ElementStub,
		HTMLElement: ElementStub,
		WheelEvent: WheelStub,
		IntersectionObserver: IntersectionStub,
		PerformanceObserver: undefined,
		navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
		CSS: { supports: () => false, escape: (value) => value },
		getComputedStyle: () => ({ getPropertyValue: () => '0ms' }),
	};
	const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
	const callbacks = [];
	const errors = [];
	const context = {
		root: document,
		requestFrame() {},
		nextFrame(_reason, callback) {
			const entry = { callback, cancelled: false };
			callbacks.push(entry);
			return () => {
				entry.cancelled = true;
			};
		},
		reportError(name, error) {
			errors.push({ name, error });
		},
	};
	return {
		document,
		window,
		context,
		errors,
		historyWrites,
		intersections,
		flush() {
			for (const pending of callbacks.splice(0)) if (!pending.cancelled) pending.callback();
		},
		restore() {
			for (const [key, descriptor] of previous) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else delete globalThis[key];
			}
		},
	};
};

export const prepareNavigation = (browser, to, options = {}) => {
	const controller = options.controller ?? new AbortController();
	const preparation = event('astro:before-preparation', {
		from: new URL(browser.window.location.href),
		to: new URL(to, browser.window.location),
		signal: controller.signal,
		loader: options.loader ?? (async () => {}),
	});
	browser.document.dispatchEvent(preparation);
	return { preparation, controller, work: preparation.loader() };
};

export const swapNavigation = (browser, preparation) => {
	const newDocument = new DocumentStub();
	const swap = event('astro:before-swap', {
		signal: preparation.signal,
		newDocument,
		swap() {
			browser.document.documentElement.dataset = { ...newDocument.documentElement.dataset };
		},
	});
	browser.document.dispatchEvent(swap);
	swap.swap();
	// Astro moves location between its swap and after-swap event.
	browser.window.location = new URL(preparation.to);
	browser.document.dispatchEvent(new Event('astro:after-swap'));
};
