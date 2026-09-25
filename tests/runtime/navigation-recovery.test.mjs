import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from '../../src/app/core/app.ts';
import { cancelRuntimeTimers } from '../../src/app/core/timer.ts';
import { device, getDeviceProfile, initDeviceProfile } from '../../src/app/systems/device.ts';
import { getInputState } from '../../src/app/systems/input.ts';
import { motion } from '../../src/app/systems/motion.ts';
import { getRouteState, route } from '../../src/app/systems/route.ts';
import { getScrollState } from '../../src/app/systems/scroll.ts';
import { lines } from '../../src/app/ui/lines.ts';
import { logo } from '../../src/app/ui/logo.ts';
import { media } from '../../src/app/ui/media.ts';
import { ElementStub, installBrowser, prepareNavigation, swapNavigation } from './interaction-harness.mjs';

class VideoStub extends ElementStub {
	src = '';
	paused = true;
	hidden = false;
	playCount = 0;
	classList = { add() {}, remove() {} };

	play() {
		this.playCount += 1;
		this.paused = false;
		this.dispatchEvent(new Event('play'));
		return Promise.resolve();
	}

	pause() {
		if (this.paused) return;
		this.paused = true;
		this.dispatchEvent(new Event('pause'));
	}

	load() {}

	removeAttribute(name) {
		super.removeAttribute(name);
		if (name === 'src') this.src = '';
	}
}

const setup = (testContext) => {
	const browser = installBrowser();
	const frames = new Map();
	let frameId = 0;
	const additions = {
		MutationObserver: class {
			observe() {}
			disconnect() {}
		},
		HTMLVideoElement: VideoStub,
		requestAnimationFrame(callback) {
			frames.set(++frameId, callback);
			return frameId;
		},
		cancelAnimationFrame(id) {
			frames.delete(id);
		},
	};
	const previous = new Map(Object.keys(additions).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	for (const [key, value] of Object.entries(additions)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
	const lineTarget = new ElementStub();
	lineTarget.dataset.lineReveal = 'body';
	lineTarget.ownerDocument = browser.document;
	const video = new VideoStub('video');
	video.dataset.src = 'https://example.test/fixture.mp4';
	video.dataset.autoplay = 'true';
	const logoTarget = new ElementStub();
	const canvas = new ElementStub('canvas');
	const fallback = new ElementStub();
	logoTarget.querySelector = (selector) => (selector === '[data-logo-canvas]' ? canvas : selector === '[data-logo-fallback]' ? fallback : null);
	browser.document.querySelectorAll = (selector) => {
		if (selector === '[data-line-reveal]') return [lineTarget];
		if (selector === 'video[data-media-video]') return [video];
		if (selector === '[data-logo]') return [logoTarget];
		return [];
	};
	initDeviceProfile({ calibrate: false });
	let refreshCount = 0;
	const refreshProbe = {
		name: 'refresh-probe',
		refresh() {
			refreshCount += 1;
		},
	};
	const app = new App([route, motion, lines, media, logo, refreshProbe], {
		getProfile: getDeviceProfile,
		getRoute: getRouteState,
		getInput: getInputState,
		getScroll: getScrollState,
		getTheme: () => ({ scheme: 'light', mode: 'system', generation: 0 }),
	});
	app.start();
	// Match the composition root's subscriptions, using the actual App refresh lifecycle.
	route.onAfterSwap(() => app.refreshPage('route:after-swap'));
	const aborts = [];
	route.onAbort((abort) => {
		aborts.push(abort);
		if (abort.needsRefresh) app.refreshPage('route:abort');
	});
	const frame = () => {
		const callbacks = [...frames.values()];
		frames.clear();
		for (const callback of callbacks) callback(16);
	};
	frame();
	testContext.after(() => {
		app.dispose();
		device.dispose();
		cancelRuntimeTimers();
		browser.restore();
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globalThis[key];
		}
	});
	const observerFor = (target) => browser.intersections.findLast((observer) => observer.targets.has(target));
	return { ...browser, app, lineTarget, video, logoTarget, aborts, frame, observerFor, refreshCount: () => refreshCount };
};

test('failed swap reinitializes pending text, video observation and logo ownership in the surviving document', async (t) => {
	const browser = setup(t);
	const initialLines = browser.observerFor(browser.lineTarget);
	const initialLogo = browser.observerFor(browser.logoTarget);
	assert.ok(initialLines);
	assert.ok(initialLogo);
	browser.observerFor(browser.video).callback([{ target: browser.video, isIntersecting: true }]);
	assert.equal(browser.video.src, browser.video.dataset.src);
	route.onBeforeSwap((event) =>
		event.wrapSwap(() => {
			throw new Error('swap failed');
		}),
	);
	const navigation = prepareNavigation(browser, '/');
	await navigation.work;
	assert.throws(() => swapNavigation(browser, navigation.preparation), /swap failed/);
	assert.deepEqual(browser.aborts, [{ id: 1, needsRefresh: true }]);
	assert.equal(browser.refreshCount(), 1);
	assert.equal(initialLines.targets.size, 0);
	assert.equal(initialLogo.targets.size, 0);
	assert.equal(browser.video.src, '');
	browser.document.dispatchEvent(new Event('astro:page-load'));
	browser.frame();
	assert.equal(browser.lineTarget.dataset.lineRevealState, 'pending');
	assert.ok(browser.observerFor(browser.lineTarget));
	assert.ok(browser.observerFor(browser.logoTarget));
	const mediaObserver = browser.observerFor(browser.video);
	assert.ok(mediaObserver);
	mediaObserver.callback([{ target: browser.video, isIntersecting: true }]);
	assert.equal(browser.video.src, browser.video.dataset.src);
	assert.equal(browser.video.paused, false);
	assert.deepEqual(browser.window.wwwRuntimeDiagnostics().errors, []);
});

test('preparation cancellation preserves existing owners and a user-paused video', async (t) => {
	const browser = setup(t);
	const initialLines = browser.observerFor(browser.lineTarget);
	const initialLogo = browser.observerFor(browser.logoTarget);
	const mediaObserver = browser.observerFor(browser.video);
	mediaObserver.callback([{ target: browser.video, isIntersecting: true }]);
	browser.video.pause();
	assert.equal(browser.video.playCount, 1);
	const navigation = prepareNavigation(browser, '/');
	navigation.controller.abort();
	await navigation.work;
	browser.frame();
	assert.deepEqual(browser.aborts, [{ id: 1, needsRefresh: false }]);
	assert.equal(browser.refreshCount(), 0);
	assert.equal(browser.observerFor(browser.lineTarget), initialLines);
	assert.equal(browser.observerFor(browser.logoTarget), initialLogo);
	assert.equal(browser.observerFor(browser.video), mediaObserver);
	assert.equal(browser.video.src, browser.video.dataset.src);
	mediaObserver.callback([{ target: browser.video, isIntersecting: true }]);
	assert.equal(browser.video.paused, true);
	assert.equal(browser.video.playCount, 1);
	assert.deepEqual(browser.window.wwwRuntimeDiagnostics().errors, []);
});
