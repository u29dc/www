import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { cancelRuntimeTimers, setTimerScheduler } from '../../src/app/core/timer.ts';
import { MOTION } from '../../src/app/core/tokens.ts';
import { device } from '../../src/app/systems/device.ts';
import { route } from '../../src/app/systems/route.ts';
import { lines } from '../../src/app/ui/lines.ts';

const originals = new Map();
const deviceMethods = { initProfile: device.initProfile, getProfile: device.getProfile, getLineRevealProfile: device.getLineRevealProfile, subscribe: device.subscribe };
const routeSubscribe = route.onBeforeSwap;
const owners = new Set();
let environment;
let resetTimerScheduler;

const replaceGlobal = (name, value) => {
	if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
};
const dataKey = (name) => name.slice(5).replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const rect = { top: 0, bottom: 20, left: 0, right: 300, width: 300, height: 20 };

class TextDouble {
	nodeType = 3;
	constructor(data) {
		this.data = data;
	}
	get length() {
		return this.data.length;
	}
}

class ElementDouble extends EventTarget {
	dataset = {};
	childNodes = [];
	attributes = new Map();
	style = {
		position: '',
		opacity: '',
		setProperty(name, value) {
			this[name] = value;
		},
	};
	clientLeft = 0;
	clientTop = 0;
	scrollLeft = 0;
	scrollTop = 0;
	isConnected = true;
	constructor(tagName = 'div', ownerDocument = environment?.document) {
		super();
		this.tagName = tagName;
		this.ownerDocument = ownerDocument;
	}
	get textContent() {
		return this.childNodes.map((child) => (child instanceof TextDouble ? child.data : child.textContent)).join('');
	}
	append(...children) {
		for (const child of children) {
			if (child.tagName === '#fragment') this.append(...child.childNodes);
			else {
				child.parentElement = this;
				this.childNodes.push(child);
			}
		}
	}
	remove() {
		this.isConnected = false;
		if (this.parentElement) this.parentElement.childNodes = this.parentElement.childNodes.filter((child) => child !== this);
	}
	setAttribute(name, value) {
		if (name.startsWith('data-')) this.dataset[dataKey(name)] = value;
		else this.attributes.set(name, value);
	}
	getAttribute(name) {
		return name.startsWith('data-') ? (this.dataset[dataKey(name)] ?? null) : (this.attributes.get(name) ?? null);
	}
	hasAttribute(name) {
		return this.getAttribute(name) !== null;
	}
	removeAttribute(name) {
		if (name.startsWith('data-')) delete this.dataset[dataKey(name)];
		else this.attributes.delete(name);
	}
	matches(selector) {
		return selector.split(',').some((part) => {
			const rule = part.trim();
			const match = /^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/.exec(rule);
			if (match) return (!match[1] || match[1] === this.tagName) && this.hasAttribute(match[2]) && (match[3] === undefined || this.getAttribute(match[2]) === match[3]);
			return rule === this.tagName;
		});
	}
	closest(selector) {
		for (let element = this; element; element = element.parentElement) if (element.matches(selector)) return element;
		return null;
	}
	querySelectorAll(selector) {
		return this.childNodes.flatMap((child) => (child instanceof ElementDouble ? [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)] : []));
	}
	getBoundingClientRect() {
		return rect;
	}
	getClientRects() {
		return [rect];
	}
	cloneNode() {
		const clone = new ElementDouble(this.tagName, this.ownerDocument);
		clone.dataset = { ...this.dataset };
		clone.attributes = new Map(this.attributes);
		clone.append(...this.childNodes.map((child) => (child instanceof TextDouble ? new TextDouble(child.data) : child.cloneNode(true))));
		return clone;
	}
}

class DocumentDouble extends EventTarget {
	constructor(fonts) {
		super();
		this.fonts = fonts;
		this.documentElement = new ElementDouble('html', this);
		this.body = new ElementDouble('body', this);
		this.documentElement.append(this.body);
	}
	querySelectorAll(selector) {
		return this.documentElement.querySelectorAll(selector);
	}
	createElement(tag) {
		return new ElementDouble(tag, this);
	}
	createDocumentFragment() {
		return new ElementDouble('#fragment', this);
	}
	createRange() {
		return {
			setStart() {},
			setEnd() {},
			getClientRects() {
				environment.rangeReads += 1;
				return [rect];
			},
		};
	}
}

class IntersectionDouble {
	constructor(callback) {
		this.callback = callback;
		this.targets = new Set();
		environment.intersection = this;
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
	enter(target) {
		assert.ok(this.targets.has(target), 'target must be observed through the lifecycle');
		this.callback([{ target, isIntersecting: true }]);
	}
}

class MutationDouble {
	constructor(callback) {
		this.callback = callback;
	}
	observe(target, options) {
		this.target = target;
		this.options = options;
		environment.mutations.add(this);
	}
	disconnect() {
		environment.mutations.delete(this);
	}
}

const drainMicrotasks = async () => {
	for (let index = 0; index < 12; index++) await Promise.resolve();
};
const flushFrame = () => {
	const frame = [...environment.frames];
	for (const [id, callback] of frame) {
		if (!environment.frames.delete(id)) continue;
		callback();
	}
};
const advanceTimers = (milliseconds) => {
	environment.now += milliseconds;
	const dueTimers = [...environment.timers];
	for (const [id, timer] of dueTimers) {
		if (timer.due > environment.now || !environment.timers.delete(id)) continue;
		timer.callback();
	}
};
const targetIn = (document = environment.document) => {
	const target = document.createElement('p');
	target.dataset['lineReveal'] = 'body';
	target.append(new TextDouble('Visible text with a link.'));
	const link = document.createElement('a');
	link.setAttribute('href', '/next');
	link.append(new TextDouble('Next'));
	target.append(link);
	document.body.append(target);
	return { target, link };
};
const overlays = () => environment.document.querySelectorAll('[data-line-reveal-overlay]');
const start = () => {
	const owner = new lines.constructor();
	owners.add(owner);
	owner.preinit(environment.context);
	owner.init();
	flushFrame();
	return owner;
};
const makeRunning = async () => {
	const elements = targetIn();
	const owner = start();
	environment.intersection.enter(elements.target);
	await drainMicrotasks();
	flushFrame();
	await drainMicrotasks();
	flushFrame();
	assert.equal(elements.target.dataset['lineRevealState'], 'running');
	assert.equal(elements.target.style.opacity, '0');
	assert.equal(overlays().length, 1);
	return { ...elements, owner };
};
const focus = (target) => {
	const event = new Event('focusin');
	Object.defineProperty(event, 'target', { value: target });
	environment.document.dispatchEvent(event);
};

before(() => {
	const fonts = Object.assign(new EventTarget(), { status: 'loaded', ready: Promise.resolve() });
	environment = { now: 0, nextId: 0, frames: new Map(), timers: new Map(), mutations: new Set(), swaps: new Set(), rangeReads: 0 };
	environment.document = new DocumentDouble(fonts);
	environment.profile = { motionQuality: 'full', lineProfile: 'full' };
	environment.context = {
		root: environment.document,
		requestFrame() {},
		nextFrame(_name, callback) {
			const id = ++environment.nextId;
			environment.frames.set(id, callback);
			return () => environment.frames.delete(id);
		},
	};
	resetTimerScheduler = setTimerScheduler((name, callback) => environment.context.nextFrame(name, callback));
	const window = {
		location: { pathname: '/test' },
		innerWidth: 1280,
		innerHeight: 900,
		devicePixelRatio: 1,
		setTimeout(callback, delay) {
			const id = ++environment.nextId;
			environment.timeoutDelays.push(delay);
			environment.timers.set(id, { callback, due: environment.now + delay });
			return id;
		},
		clearTimeout(id) {
			environment.timers.delete(id);
		},
	};
	for (const [name, value] of Object.entries({
		document: environment.document,
		window,
		Element: ElementDouble,
		HTMLElement: ElementDouble,
		Document: DocumentDouble,
		HTMLMediaElement: class extends ElementDouble {},
		Node: { TEXT_NODE: 3 },
		IntersectionObserver: IntersectionDouble,
		MutationObserver: MutationDouble,
		ResizeObserver: class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
		performance: { now: () => environment.now },
		getComputedStyle: () => ({ position: 'static', font: '16px serif', lineHeight: '20px', getPropertyValue: () => '' }),
	}))
		replaceGlobal(name, value);
	device.initProfile = () => environment.profile;
	device.getProfile = () => environment.profile;
	device.getLineRevealProfile = () => 'full';
	device.subscribe = () => () => {};
	route.onBeforeSwap = (callback) => {
		environment.swaps.add(callback);
		return () => environment.swaps.delete(callback);
	};
});

beforeEach(() => {
	environment.document.body.childNodes = [];
	environment.document.documentElement.dataset = {};
	environment.document.fonts.status = 'loaded';
	environment.document.fonts.ready = Promise.resolve();
	environment.rangeReads = 0;
	environment.now = 0;
	environment.timeoutDelays = [];
});

afterEach(async () => {
	for (const owner of owners) owner.dispose();
	owners.clear();
	cancelRuntimeTimers();
	await drainMicrotasks();
	environment.frames.clear();
	environment.timers.clear();
});

after(() => {
	resetTimerScheduler();
	Object.assign(device, deviceMethods);
	route.onBeforeSwap = routeSubscribe;
	for (const [name, descriptor] of originals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete globalThis[name];
	}
});

test('fonts still loading after the bounded wait leave original text visible without measuring', async () => {
	environment.document.fonts.status = 'loading';
	environment.document.fonts.ready = new Promise(() => {});
	const { target } = targetIn();
	start();
	environment.intersection.enter(target);
	await drainMicrotasks();
	advanceTimers(MOTION.line.fontWaitMs);
	flushFrame();
	await drainMicrotasks();
	flushFrame();
	await drainMicrotasks();
	assert.equal(target.dataset['lineRevealState'], 'fallback');
	assert.equal(target.style.opacity, '');
	assert.equal(overlays().length, 0);
	assert.equal(environment.rangeReads, 0);
});

test('article paragraphs share one continuous line stagger beyond the former 24-line cap', async () => {
	const targets = Array.from({ length: 30 }, () => targetIn().target);
	const article = environment.document.createElement('article');
	article.dataset['lineRevealGroup'] = 'article-content';
	environment.document.body.childNodes = [];
	article.append(...targets);
	environment.document.body.append(article);
	start();
	assert.deepEqual([...environment.intersection.targets], [article]);
	environment.intersection.enter(article);
	await drainMicrotasks();
	flushFrame();
	await drainMicrotasks();
	flushFrame();
	const prepared = overlays();
	assert.equal(prepared.length, 30);
	const delays = prepared.flatMap((overlay) => overlay.childNodes.map((mask) => Number.parseFloat(mask.style['--line-reveal-delay'])));
	assert.equal(delays.length, 30);
	assert.equal(delays[0], 0);
	for (let index = 1; index < delays.length; index++) assert.ok(delays[index] > delays[index - 1], `line ${index + 1} must continue the article timeline`);
	assert.ok(delays.at(-1) <= MOTION.line.maxTotalMs - MOTION.line.durationMs);
	for (const target of targets) assert.equal(target.dataset['lineRevealState'], 'running');
});

test('already-loaded fonts do not allocate a font timeout', async () => {
	const { target } = targetIn();
	start();
	environment.intersection.enter(target);
	await drainMicrotasks();
	assert.deepEqual(environment.timeoutDelays, [MOTION.line.frameWaitMs]);
	assert.equal(environment.frames.size, 1);
});

for (const timeoutDue of [false, true]) {
	test(`font readiness cancels its ${timeoutDue ? 'already-queued frame callback' : 'pending timeout'}`, async () => {
		const ready = Promise.withResolvers();
		environment.document.fonts.status = 'loading';
		environment.document.fonts.ready = ready.promise;
		const { target } = targetIn();
		start();
		environment.intersection.enter(target);
		await drainMicrotasks();
		assert.equal(environment.timers.size, 1);
		const [fontTimerId] = environment.timers.keys();
		let fontFrameId;
		if (timeoutDue) {
			advanceTimers(MOTION.line.fontWaitMs);
			assert.equal(environment.frames.size, 1);
			[fontFrameId] = environment.frames.keys();
		}

		environment.document.fonts.status = 'loaded';
		ready.resolve();
		await drainMicrotasks();
		assert.equal(environment.timers.has(fontTimerId), false);
		if (timeoutDue) assert.equal(environment.frames.has(fontFrameId), false);
		assert.deepEqual(environment.timeoutDelays, [MOTION.line.fontWaitMs, MOTION.line.frameWaitMs]);
		flushFrame();
		await drainMicrotasks();
		flushFrame();
		assert.equal(target.dataset['lineRevealState'], 'running');
		assert.equal(overlays().length, 1);
	});
}

for (const eventName of ['loading', 'loadingdone']) {
	test(`font ${eventName} cancels active overlays synchronously`, async () => {
		const { target } = await makeRunning();
		environment.document.fonts.dispatchEvent(new Event(eventName));
		assert.equal(target.dataset['lineRevealState'], 'fallback');
		assert.equal(target.style.opacity, '');
		assert.equal(overlays().length, 0);
	});
}

test('root typography changes cancel active overlays without waiting for another frame', async () => {
	const { target } = await makeRunning();
	for (const observer of environment.mutations) {
		if (observer.options.attributeFilter.includes('class')) observer.callback([{ attributeName: 'class', target: environment.document.documentElement }]);
	}
	assert.equal(target.dataset['lineRevealState'], 'fallback');
	assert.equal(target.style.opacity, '');
	assert.equal(overlays().length, 0);
});

test('keyboard focus in a pending paragraph exposes the original and skips later enhancement', async () => {
	const { target, link } = targetIn();
	start();
	assert.equal(target.dataset['lineRevealState'], 'pending');
	focus(link);
	assert.equal(target.dataset['lineRevealState'], 'fallback');
	assert.equal(target.style.opacity, '');
	environment.intersection.enter(target);
	await drainMicrotasks();
	flushFrame();
	await drainMicrotasks();
	assert.equal(overlays().length, 0);
	assert.equal(environment.rangeReads, 0);
});

test('keyboard focus in a running paragraph restores the real focused link immediately', async () => {
	const { target, link } = await makeRunning();
	focus(link);
	assert.equal(target.dataset['lineRevealState'], 'fallback');
	assert.equal(target.style.opacity, '');
	assert.equal(overlays().length, 0);
});

test('an aborted font wait does not leave an obsolete frame wait blocking the next document', async () => {
	environment.document.fonts.status = 'loading';
	environment.document.fonts.ready = new Promise(() => {});
	const old = targetIn();
	const owner = start();
	environment.intersection.enter(old.target);
	await drainMicrotasks();
	advanceTimers(MOTION.line.fontWaitMs);
	assert.equal(environment.rangeReads, 0);
	assert.equal(environment.frames.size, 1, 'a due font timeout parks in the shared frame queue while frames are unavailable');
	const nextDocument = new DocumentDouble(environment.document.fonts);
	const next = targetIn(nextDocument);
	for (const callback of environment.swaps) callback({ newDocument: nextDocument });
	old.target.isConnected = false;
	await drainMicrotasks();
	assert.equal(environment.frames.size, 0, 'aborted preparation must not require a frame from the old document');
	environment.document.body.childNodes = nextDocument.body.childNodes;
	for (const element of environment.document.querySelectorAll('[data-line-reveal],a')) element.ownerDocument = environment.document;
	next.target.parentElement = environment.document.body;
	environment.document.fonts.status = 'loaded';
	environment.document.fonts.ready = Promise.resolve();
	owner.refresh();
	flushFrame();
	environment.intersection.enter(next.target);
	await drainMicrotasks();
	flushFrame();
	await drainMicrotasks();
	flushFrame();
	assert.equal(next.target.dataset['lineRevealState'], 'running');
	assert.equal(overlays().length, 1);
	assert.equal(old.target.style.opacity, '');
});
