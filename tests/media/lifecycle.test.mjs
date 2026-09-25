import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { device } from '../../src/app/systems/device.ts';
import { media } from '../../src/app/ui/media.ts';
import { preview } from '../../src/app/ui/preview.ts';

const descriptors = new Map();
const deviceMethods = { initProfile: device.initProfile, getProfile: device.getProfile, subscribe: device.subscribe };
let environment;

const replaceGlobal = (name, value) => {
	if (!descriptors.has(name)) descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
};

class ElementDouble extends EventTarget {
	dataset = {};
	children = [];
	style = { setProperty() {} };
	classList = { add() {}, remove() {} };
	attributes = new Map();
	isConnected = true;
	hidden = false;
	append(...children) {
		this.children.push(...children);
	}
	remove() {
		this.isConnected = false;
	}
	setAttribute(name, value) {
		this.attributes.set(name, value);
	}
	removeAttribute(name) {
		this.attributes.delete(name);
		if (name === 'src') this.src = '';
	}
	closest() {
		return null;
	}
	getBoundingClientRect() {
		return { top: 0, bottom: 175, left: 0, right: 280, width: 280, height: 175 };
	}
}

class VideoDouble extends ElementDouble {
	paused = true;
	src = '';
	controls = false;
	playCount = 0;
	pauseCount = 0;
	loadCount = 0;
	frames = new Map();
	frameId = 0;
	play() {
		this.playCount += 1;
		if (this.paused) {
			this.paused = false;
			environment.events.push(() => this.dispatchEvent(new Event('play')));
		}
		return Promise.resolve();
	}
	pause() {
		if (this.paused) return;
		this.pauseCount += 1;
		this.paused = true;
		environment.events.push(() => this.dispatchEvent(new Event('pause')));
	}
	load() {
		this.loadCount += 1;
	}
	requestVideoFrameCallback(callback) {
		const id = ++this.frameId;
		this.frames.set(id, callback);
		return id;
	}
	cancelVideoFrameCallback(id) {
		this.frames.delete(id);
	}
}

class ImageDouble extends ElementDouble {
	complete = false;
	naturalWidth = 0;
	set src(value) {
		this.source = value;
		if (value) environment.imageSources.push(value);
	}
	get src() {
		return this.source ?? '';
	}
	decode() {
		return Promise.resolve();
	}
}

class IntersectionDouble {
	constructor(callback) {
		this.callback = callback;
		environment.intersection = this;
	}
	observe() {}
	unobserve() {}
	disconnect() {}
	set(video, isIntersecting) {
		this.callback([{ target: video, isIntersecting }]);
	}
}

const createEnvironment = () => {
	const env = {
		videos: [],
		images: [],
		targets: [],
		events: [],
		frames: [],
		idle: new Map(),
		imageSources: [],
		profile: {
			tier: 'high',
			motionQuality: 'full',
			networkProfile: 'normal',
			inputProfile: 'fine',
			allowHoverVideo: true,
			signals: { hover: true },
		},
	};
	const document = Object.assign(new EventTarget(), {
		hidden: false,
		documentElement: new ElementDouble(),
		body: new ElementDouble(),
		querySelectorAll: (selector) => (selector.startsWith('video') ? env.videos : selector.startsWith('img') ? env.images : env.targets),
		createElement: (tag) => (tag === 'video' ? new VideoDouble() : tag === 'img' ? new ImageDouble() : new ElementDouble()),
	});
	let idleId = 0;
	const window = Object.assign(new EventTarget(), {
		innerWidth: 1280,
		innerHeight: 900,
		requestIdleCallback: (callback) => {
			const id = ++idleId;
			env.idle.set(id, callback);
			return id;
		},
		cancelIdleCallback: (id) => env.idle.delete(id),
		setTimeout,
		clearTimeout,
	});
	env.document = document;
	env.window = window;
	env.flushEvents = () => {
		while (env.events.length) env.events.shift()();
	};
	env.flushIdle = () => {
		for (const callback of env.idle.values()) callback();
		env.idle.clear();
	};
	env.context = {
		root: document,
		requestFrame() {},
		nextFrame: (_name, callback) => {
			env.frames.push(callback);
			return () => {};
		},
	};
	return env;
};

const start = (singleton) => {
	const owner = new singleton.constructor();
	owner.preinit(environment.context);
	owner.init();
	return owner;
};

const videoInView = (autoplay = true) => {
	const video = new VideoDouble();
	video.src = 'video.webm';
	video.dataset['autoplay'] = String(autoplay);
	environment.videos.push(video);
	const owner = start(media);
	environment.intersection.set(video, true);
	environment.flushEvents();
	return { owner, video };
};

const previewConfig = { kind: 'video', src: 'preview.webm', ratio: 1.6, fit: 'cover', alt: 'Preview', mode: 'artifact', posterSrc: 'poster.webp' };

before(() => {
	device.initProfile = () => environment.profile;
	device.getProfile = () => environment.profile;
	device.subscribe = (callback) => {
		callback(environment.profile);
		return () => {};
	};
});

beforeEach(() => {
	environment = createEnvironment();
	for (const [name, value] of Object.entries({
		document: environment.document,
		window: environment.window,
		HTMLElement: ElementDouble,
		HTMLVideoElement: VideoDouble,
		HTMLImageElement: ImageDouble,
		Image: ImageDouble,
		IntersectionObserver: IntersectionDouble,
	}))
		replaceGlobal(name, value);
});

after(() => {
	Object.assign(device, deviceMethods);
	for (const [name, descriptor] of descriptors) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete globalThis[name];
	}
});

test('article videos suspend synchronously with the frame scheduler parked', () => {
	const { owner, video } = videoInView();
	assert.equal(video.paused, false);
	environment.document.hidden = true;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	assert.equal(video.paused, true);
	assert.equal(environment.frames.length, 0);
	environment.flushEvents();
	environment.document.hidden = false;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	assert.equal(video.paused, false);
	owner.dispose();
});

test('blocked autoplay leaves portfolio video controls hidden', async () => {
	const video = new VideoDouble();
	video.dataset['autoplay'] = 'true';
	video.play = () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
	environment.videos.push(video);
	const owner = start(media);
	environment.intersection.set(video, true);
	await Promise.resolve();
	assert.equal(video.controls, false);
	assert.equal(video.paused, true);
	owner.dispose();
});

test('motion and data preferences never add portfolio video controls', () => {
	const { owner, video } = videoInView();
	environment.profile.motionQuality = 'reduced';
	owner.handleMotionChange();
	assert.equal(video.paused, true);
	assert.equal(video.controls, false);
	environment.flushEvents();
	environment.intersection.set(video, true);
	assert.equal(video.controls, false);
	environment.profile.motionQuality = 'full';
	environment.profile.networkProfile = 'save-data';
	owner.handleMotionChange();
	assert.equal(video.controls, false);
	owner.dispose();
});

test('an explicit user pause survives intersections and background transitions', () => {
	const { owner, video } = videoInView();
	video.pause();
	environment.flushEvents();
	const plays = video.playCount;
	environment.intersection.set(video, false);
	environment.intersection.set(video, true);
	environment.document.hidden = true;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	environment.document.hidden = false;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	owner.handleMotionChange();
	assert.equal(video.paused, true);
	assert.equal(video.playCount, plays);
	owner.dispose();
});

test('native pause is respected before its queued pause event reaches the owner', () => {
	const { owner, video } = videoInView();
	video.pause();
	const plays = video.playCount;
	owner.handleMotionChange();
	environment.intersection.set(video, true);
	environment.flushEvents();
	assert.equal(video.paused, true);
	assert.equal(video.playCount, plays);
	owner.dispose();
});

test('an older owner pause event cannot obscure a later native pause', () => {
	const { owner, video } = videoInView();
	environment.intersection.set(video, false);
	environment.intersection.set(video, true);
	video.pause();
	const plays = video.playCount;
	owner.handleMotionChange();
	while (environment.events.length) {
		environment.events.shift()();
		owner.handleMotionChange();
	}
	assert.equal(video.paused, true);
	assert.equal(video.playCount, plays);
	owner.dispose();
});

test('queued play events cannot restart a video after synchronous hidden suspension', () => {
	const video = new VideoDouble();
	video.dataset['autoplay'] = 'true';
	environment.videos.push(video);
	const owner = start(media);
	environment.intersection.set(video, true);
	environment.document.hidden = true;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	environment.flushEvents();
	assert.equal(video.paused, true);
	environment.document.hidden = false;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	environment.flushEvents();
	assert.equal(video.paused, false);
	owner.dispose();
});

test('manual non-autoplay playback resumes after owner suspension, never before first play', () => {
	const { owner, video } = videoInView(false);
	assert.equal(video.playCount, 0);
	void video.play();
	environment.flushEvents();
	environment.intersection.set(video, false);
	assert.equal(video.paused, true);
	environment.flushEvents();
	environment.intersection.set(video, true);
	assert.equal(video.paused, false);
	owner.dispose();
});

test('pagehide pauses immediately and blocks intersection playback until pageshow', () => {
	const { owner, video } = videoInView();
	environment.window.dispatchEvent(new Event('pagehide'));
	assert.equal(video.paused, true);
	environment.flushEvents();
	environment.intersection.set(video, true);
	assert.equal(video.paused, true);
	environment.window.dispatchEvent(new Event('pageshow'));
	assert.equal(video.paused, false);
	owner.dispose();
	assert.equal(video.src, '');
	assert.equal(video.loadCount, 1);
});

test('preview hiding pauses videos and cancels pending first-frame callbacks without a frame', () => {
	const owner = start(preview);
	const slot = owner.createSlot(previewConfig);
	owner.activeSlot = slot;
	owner.playVideoSlot(slot);
	assert.equal(slot.media.paused, false);
	assert.equal(slot.media.frames.size, 1);
	environment.document.hidden = true;
	environment.document.dispatchEvent(new Event('visibilitychange'));
	assert.equal(slot.media.paused, true);
	assert.equal(slot.media.frames.size, 0);
	assert.equal(owner.elements.root.hidden, true);
	assert.equal(environment.frames.length, 0);
	owner.dispose();
	assert.equal(slot.media.src, '');
	assert.equal(slot.media.loadCount, 1);
});

test('preview disposal ignores late media success and exposes deliberate failure hooks', async () => {
	const owner = start(preview);
	const slot = owner.createSlot(previewConfig);
	slot.media.dispatchEvent(new Event('error'));
	assert.equal(slot.root.dataset['mediaState'], 'missing');
	assert.equal(slot.media.hidden, true);
	assert.equal(slot.root.dataset['posterState'], 'available');
	slot.poster.dispatchEvent(new Event('error'));
	assert.equal(slot.root.dataset['posterState'], 'missing');
	assert.equal(slot.root.dataset['previewFallback'], 'Preview unavailable');
	owner.removeSlot(slot);
	slot.media.dispatchEvent(new Event('canplay'));
	await Promise.resolve();
	assert.equal(slot.ready, false);
	owner.dispose();
});

const hoverTarget = (kind = 'video') => {
	const target = new ElementDouble();
	Object.assign(target.dataset, {
		hoverPreviewTarget: 'artifact',
		hoverPreviewKind: kind,
		hoverPreviewSrc: kind === 'video' ? 'preview.webm' : 'preview.webp',
		hoverPreviewPosterSrc: 'poster.webp',
		hoverPreviewRatio: '1.6',
	});
	return target;
};

for (const policy of ['save-data', 'slow', 'reduced', 'low']) {
	test(`hovering a video on ${policy} uses its poster without attaching or loading video`, () => {
		environment.profile.allowHoverVideo = false;
		if (policy === 'low') environment.profile.tier = 'low';
		else if (policy === 'reduced') environment.profile.motionQuality = 'reduced';
		else environment.profile.networkProfile = policy;
		const owner = start(preview);
		owner.showPreview(hoverTarget(), { x: 40, y: 100 });
		const slot = owner.activeSlot;
		assert.equal(owner.elements.root.hidden, false);
		assert.equal(slot.poster.src, 'poster.webp');
		assert.equal(slot.media.src, '');
		assert.equal(slot.media.preload, 'none');
		assert.equal(slot.media.playCount, 0);
		assert.equal(slot.media.loadCount, 0);
		assert.equal(slot.media.frames.size, 0);
		owner.dispose();
		assert.equal(slot.media.loadCount, 0);
	});
}

test('an active poster-only preview attaches its video when capabilities improve', () => {
	environment.profile.allowHoverVideo = false;
	environment.profile.networkProfile = 'save-data';
	const owner = start(preview);
	owner.showPreview(hoverTarget(), { x: 40, y: 100 });
	const slot = owner.activeSlot;
	assert.equal(slot.media.src, '');
	environment.profile.allowHoverVideo = true;
	environment.profile.networkProfile = 'normal';
	owner.handleDeviceProfileChange();
	assert.equal(slot.media.src, 'preview.webm');
	assert.equal(slot.media.playCount, 1);
	assert.equal(slot.media.paused, false);
	owner.dispose();
});

test('a capability downgrade releases the active video and restores its poster', () => {
	const owner = start(preview);
	owner.showPreview(hoverTarget(), { x: 40, y: 100 });
	const slot = owner.activeSlot;
	slot.media.dispatchEvent(new Event('canplay'));
	assert.equal(slot.ready, true);
	environment.profile.allowHoverVideo = false;
	environment.profile.networkProfile = 'save-data';
	owner.handleDeviceProfileChange();
	slot.media.dispatchEvent(new Event('canplay'));
	assert.equal(slot.media.src, '');
	assert.equal(slot.media.paused, true);
	assert.equal(slot.media.loadCount, 1);
	assert.equal(slot.ready, false);
	assert.equal(slot.root.dataset['ready'], 'false');
	assert.equal(slot.poster.src, 'poster.webp');
	owner.dispose();
	assert.equal(slot.media.loadCount, 1);
});

test('an image preview remains available when hover video is restricted', () => {
	environment.profile.allowHoverVideo = false;
	environment.profile.networkProfile = 'save-data';
	const owner = start(preview);
	owner.showPreview(hoverTarget('image'), { x: 40, y: 100 });
	assert.equal(owner.activeSlot.media.src, 'preview.webp');
	assert.equal(owner.elements.root.hidden, false);
	owner.dispose();
});

for (const policy of ['coarse', 'slow', 'save-data', 'hidden']) {
	test(`preview prewarming sends no request when ${policy}`, () => {
		const target = new ElementDouble();
		target.dataset['hoverPreviewSrc'] = 'preview.webp';
		environment.targets.push(target);
		if (policy === 'coarse') environment.profile.inputProfile = 'coarse';
		else if (policy === 'hidden') environment.document.hidden = true;
		else environment.profile.networkProfile = policy;
		const owner = start(preview);
		environment.flushIdle();
		assert.equal(environment.imageSources.length, 0);
		owner.dispose();
	});
}

test('prewarming rechecks eligibility at idle time and remains retryable', () => {
	const target = new ElementDouble();
	target.dataset['hoverPreviewSrc'] = 'preview.webp';
	environment.targets.push(target);
	const owner = start(preview);
	assert.equal(environment.idle.size, 1);
	environment.profile.networkProfile = 'slow';
	environment.flushIdle();
	assert.deepEqual(environment.imageSources, []);
	environment.profile.networkProfile = 'normal';
	owner.prewarmImagePreviews();
	environment.flushIdle();
	assert.deepEqual(environment.imageSources, ['preview.webp']);
	owner.dispose();
});

test('prewarming ignores detached targets before allocating images', () => {
	const target = new ElementDouble();
	target.dataset['hoverPreviewSrc'] = 'preview.webp';
	environment.targets.push(target);
	const owner = start(preview);
	target.isConnected = false;
	environment.flushIdle();
	assert.deepEqual(environment.imageSources, []);
	owner.dispose();
});
