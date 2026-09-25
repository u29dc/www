import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelRuntimeTimers } from '../../src/app/core/timer.ts';
import { device, initDeviceProfile } from '../../src/app/systems/device.ts';
import { motion } from '../../src/app/systems/motion.ts';
import { route } from '../../src/app/systems/route.ts';
import { deferred, ElementStub, installBrowser, prepareNavigation, swapNavigation } from './interaction-harness.mjs';

const setup = (testContext) => {
	const browser = installBrowser();
	initDeviceProfile({ calibrate: false });
	route.preinit(browser.context);
	route.init();
	motion.preinit(browser.context);
	motion.init();
	testContext.after(() => {
		motion.dispose();
		route.dispose();
		device.dispose();
		cancelRuntimeTimers();
		browser.restore();
	});
	return browser;
};

test('late initial page-load cannot invalidate a pending navigation or strand its exit styles', async (t) => {
	const browser = setup(t);
	const gate = deferred();
	route.onPreparation(() => gate.promise);
	const navigation = prepareNavigation(browser, '/');
	assert.equal(browser.document.documentElement.dataset.pageState, 'exiting');
	browser.document.dispatchEvent(new Event('astro:page-load'));
	assert.equal(route.getState().page, 'exiting');
	gate.resolve();
	await navigation.work;
	assert.equal(navigation.preparation.defaultPrevented, false);
	swapNavigation(browser, navigation.preparation);
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
	assert.equal(route.getState().current, 'home');
	browser.document.dispatchEvent(new Event('astro:page-load'));
	assert.equal(route.getState().page, 'idle');
	assert.equal(browser.errors.length, 0);
});

test('an old navigation cancellation resolves and cannot clear the next navigation', async (t) => {
	const browser = setup(t);
	const oldFetch = deferred();
	const first = prepareNavigation(browser, '/', { loader: () => oldFetch.promise });
	first.controller.abort();
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
	const second = prepareNavigation(browser, '/trap');
	oldFetch.reject(new DOMException('Expected fetch cancellation', 'AbortError'));
	await first.work;
	await second.work;
	assert.equal(route.getState().page, 'exiting');
	assert.equal(first.preparation.defaultPrevented, false);
	swapNavigation(browser, second.preparation);
	assert.equal(route.getState().pathname, '/trap');
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
	assert.equal(browser.errors.length, 0);
});

test('genuine preparation failure restores the document and requests Astro native fallback', async (t) => {
	const browser = setup(t);
	const failure = new Error('loader failed');
	const navigation = prepareNavigation(browser, '/', {
		loader: async () => {
			throw failure;
		},
	});
	await navigation.work;
	assert.equal(navigation.preparation.defaultPrevented, true);
	assert.equal(route.getState().page, 'idle');
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
	assert.deepEqual(browser.errors, [{ name: 'route.preparation', error: failure }]);
});

test('original loader native fallback also restores exit state before leaving', async (t) => {
	const browser = setup(t);
	const fetch = deferred();
	const navigation = prepareNavigation(browser, '/', { loader: () => fetch.promise });
	navigation.preparation.preventDefault();
	fetch.resolve();
	await navigation.work;
	assert.equal(route.getState().page, 'idle');
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
});

test('late completion from an already swapped page cannot complete a newer preparation', async (t) => {
	const browser = setup(t);
	const first = prepareNavigation(browser, '/');
	await first.work;
	swapNavigation(browser, first.preparation);
	const second = prepareNavigation(browser, '/trap');
	first.controller.abort();
	browser.document.dispatchEvent(new Event('astro:page-load'));
	assert.equal(route.getState().page, 'exiting');
	assert.equal(browser.document.documentElement.dataset.pageState, 'exiting');
	await second.work;
	swapNavigation(browser, second.preparation);
	assert.equal(route.getState().pathname, '/trap');
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
});

test('navigation started by a load subscriber survives completion of that load event', async (t) => {
	const browser = setup(t);
	let navigation;
	route.onLoad(() => {
		navigation = prepareNavigation(browser, '/');
	});
	browser.document.dispatchEvent(new Event('astro:page-load'));
	assert.equal(route.getState().page, 'exiting');
	await navigation.work;
	swapNavigation(browser, navigation.preparation);
	assert.equal(route.getState().current, 'home');
});

test('swap-wrapper failure restores exit styles', async (t) => {
	const browser = setup(t);
	route.onBeforeSwap((event) =>
		event.wrapSwap(() => {
			throw new Error('swap failed');
		}),
	);
	const navigation = prepareNavigation(browser, '/');
	await navigation.work;
	assert.throws(() => swapNavigation(browser, navigation.preparation), /swap failed/);
	assert.equal(route.getState().page, 'idle');
	assert.equal(browser.document.documentElement.dataset.pageState, undefined);
});

test('aborting exit re-observes reveal targets that were waiting for a completed line group', async (t) => {
	const browser = setup(t);
	const target = new ElementStub();
	target.dataset.reveal = 'waiting';
	target.dataset.revealAfterLineGroup = 'origin';
	browser.document.reveals.push(target);
	browser.document.documentElement.dataset.lineRevealCompleteGroups = 'origin';
	const navigation = prepareNavigation(browser, '/');
	navigation.controller.abort();
	await navigation.work;
	assert.equal(target.dataset.reveal, 'pending');
	const observer = browser.intersections.at(-1);
	assert.equal(observer.targets.has(target), true);
	observer.callback([{ isIntersecting: true, target }]);
	assert.equal(target.dataset.reveal, 'visible');
});
