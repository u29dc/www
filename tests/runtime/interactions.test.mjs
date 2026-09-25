import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelRuntimeTimers } from '../../src/app/core/timer.ts';
import { device, getDeviceProfile, initDeviceProfile } from '../../src/app/systems/device.ts';
import { input } from '../../src/app/systems/input.ts';
import { route } from '../../src/app/systems/route.ts';
import { scroll } from '../../src/app/systems/scroll.ts';
import { ElementStub, event, installBrowser } from './interaction-harness.mjs';

const setup = (testContext, options) => {
	const browser = installBrowser('/trap', options);
	initDeviceProfile({ calibrate: false });
	Object.defineProperty(browser.context, 'profile', { get: getDeviceProfile });
	route.preinit(browser.context);
	route.init();
	input.preinit(browser.context);
	scroll.preinit(browser.context);
	scroll.init();
	testContext.after(() => {
		scroll.dispose();
		input.dispose();
		route.dispose();
		device.dispose();
		cancelRuntimeTimers();
		browser.restore();
	});
	return browser;
};

const footnote = (browser, attributes = {}) => {
	// Attributes match remark-gfm's footnote links rendered by core/link.astro.
	const anchor = new ElementStub('a', { href: '#user-content-fn-1', 'data-footnote-ref': '', ...attributes });
	anchor.href = new URL('#user-content-fn-1', browser.window.location).href;
	anchor.target = attributes.target ?? '';
	const target = new ElementStub('li', { id: 'user-content-fn-1' });
	browser.document.targets.set('user-content-fn-1', target);
	return { anchor, target };
};

const click = (browser, anchor, modifiers = {}) => {
	const activation = event('click', {
		button: 0,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		target: anchor,
		composedPath: () => [anchor],
		...modifiers,
	});
	browser.document.dispatchEvent(activation);
	return activation;
};

const wheel = (browser, overrides = {}) => {
	const intent = event('wheel', {
		deltaX: 0,
		deltaY: 300,
		deltaMode: 0,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		composedPath: () => [],
		...overrides,
	});
	browser.document.dispatchEvent(intent);
	return intent;
};

const update = (browser) => {
	browser.flush();
	scroll.update({ visible: true, dt: 1 / 60, input: input.getState() });
	input.flushFrame();
};

test('Enter footnote activation preserves router history ownership, native scroll and destination focus', (t) => {
	const browser = setup(t);
	const { anchor, target } = footnote(browser);
	browser.document.dispatchEvent(event('keydown', { key: 'Enter', code: 'Enter' }));
	assert.equal(click(browser, anchor).defaultPrevented, false);
	assert.equal(browser.window.location.hash, '');
	assert.deepEqual(browser.historyWrites, []);
	// The native/router link action runs after click propagation, before the app frame.
	browser.window.location = new URL(anchor.href);
	browser.window.scrollY = 1500;
	browser.window.history.state = { index: 5, scrollX: 0, scrollY: 1500 };
	browser.window.dispatchEvent(new Event('hashchange'));
	browser.window.dispatchEvent(new Event('scroll'));
	update(browser);
	assert.equal(browser.window.scrollY, 1500);
	assert.equal(scroll.getState().actual, 1500);
	assert.equal(scroll.getState().active, false);
	assert.equal(route.getState().hash, '#user-content-fn-1');
	assert.deepEqual(target.focusOptions, { preventScroll: true });
	assert.equal(target.getAttribute('tabindex'), '-1');
	target.dispatchEvent(new Event('blur'));
	assert.equal(target.hasAttribute('tabindex'), false);
	assert.deepEqual(browser.historyWrites, []);
});

test('back and forward restoration interrupt smoothing and synchronize after the native history event', (t) => {
	const browser = setup(t);
	browser.window.location.hash = '#user-content-fn-1';
	browser.window.scrollY = 1500;
	browser.window.dispatchEvent(new Event('scroll'));
	wheel(browser);
	assert.equal(scroll.getState().active, true);
	browser.window.location.hash = '';
	browser.window.dispatchEvent(new Event('popstate'));
	// Also cover history restoration happening after the listener rather than before it.
	browser.window.scrollY = 400;
	update(browser);
	assert.equal(scroll.getState().actual, 400);
	assert.equal(scroll.getState().target, 400);
	assert.equal(scroll.getState().active, false);
	assert.equal(route.getState().hash, '');
	browser.window.location.hash = '#user-content-fn-1';
	browser.window.scrollY = 1500;
	browser.window.dispatchEvent(new Event('popstate'));
	update(browser);
	assert.equal(scroll.getState().target, 1500);
	assert.equal(route.getState().hash, '#user-content-fn-1');
	assert.deepEqual(browser.historyWrites, []);
});

test('same-page _self links retain destination focus, but downloads and modified clicks stay untouched', (t) => {
	const browser = setup(t);
	const self = footnote(browser, { target: '_self' });
	assert.equal(click(browser, self.anchor).defaultPrevented, false);
	browser.window.location = new URL(self.anchor.href);
	update(browser);
	assert.deepEqual(self.target.focusOptions, { preventScroll: true });
	const download = footnote(browser, { download: '' });
	assert.equal(click(browser, download.anchor).defaultPrevented, false);
	update(browser);
	assert.equal(download.target.focusOptions, undefined);
	const modified = footnote(browser);
	assert.equal(click(browser, modified.anchor, { ctrlKey: true }).defaultPrevented, false);
	update(browser);
	assert.equal(modified.target.focusOptions, undefined);
});

test('wheel enhancement preserves horizontal gestures, zoom and nested native controls', (t) => {
	const browser = setup(t);
	assert.equal(scroll.getState().enabled, true);
	for (const override of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaX: 400, deltaY: 10 }]) {
		assert.equal(wheel(browser, override).defaultPrevented, false);
	}
	const nativeControl = new ElementStub('div', { 'data-native-scroll': '' });
	assert.equal(wheel(browser, { composedPath: () => [nativeControl] }).defaultPrevented, false);
	assert.equal(wheel(browser).defaultPrevented, true);
	assert.equal(scroll.getState().target, 300);
	update(browser);
	assert.ok(browser.window.scrollY > 0);
	assert.ok(browser.window.scrollY < 300);
});

test('scroll owner can dispose and initialize again without losing wheel handling', (t) => {
	const browser = setup(t);
	assert.equal(wheel(browser).defaultPrevented, true);
	scroll.dispose();
	assert.equal(wheel(browser).defaultPrevented, false);
	scroll.preinit(browser.context);
	scroll.init();
	assert.equal(wheel(browser).defaultPrevented, true);
	assert.equal(scroll.getState().target, 300);
});

for (const [name, options] of [
	['reduced motion', { reducedMotion: true }],
	['small screens', { width: 375 }],
]) {
	test(`${name} preserve native wheel and footnote activation`, (t) => {
		const browser = setup(t, options);
		assert.equal(scroll.getState().enabled, false);
		assert.equal(wheel(browser).defaultPrevented, false);
		const { anchor } = footnote(browser);
		assert.equal(click(browser, anchor).defaultPrevented, false);
		assert.deepEqual(browser.historyWrites, []);
	});
}

test('page refresh releases keyboard state and detached pointer references', (t) => {
	const browser = setup(t);
	const previousTarget = new ElementStub();
	const cancellations = [];
	input.onPointerIntent((intent) => {
		if (intent.type === 'cancel') cancellations.push(intent);
	});
	browser.document.dispatchEvent(
		event('pointermove', {
			clientX: 120,
			clientY: 90,
			pointerType: 'mouse',
			relatedTarget: null,
			target: previousTarget,
			composedPath: () => [previousTarget, browser.document.body],
		}),
	);
	browser.document.dispatchEvent(event('keydown', { key: 'Tab', code: 'Tab' }));
	input.flushFrame();
	previousTarget.isConnected = false;
	input.refresh();
	const state = input.getState();
	assert.equal(state.pointer.target, null);
	assert.deepEqual(state.pointer.path, []);
	assert.deepEqual(state.keyboard.activeKeys, []);
	assert.equal(state.pointer.x, 120);
	assert.equal(cancellations.length, 1);
	assert.deepEqual(cancellations[0].path, []);
});

test('input loss cancels hover even when no pointer button or key is held', (t) => {
	const browser = setup(t);
	const target = new ElementStub();
	const cancellations = [];
	input.onPointerIntent((intent) => {
		if (intent.type === 'cancel') cancellations.push(intent);
	});
	browser.document.dispatchEvent(
		event('pointermove', {
			clientX: 30,
			clientY: 40,
			pointerType: 'mouse',
			relatedTarget: null,
			target,
			composedPath: () => [target],
		}),
	);
	browser.window.dispatchEvent(new Event('blur'));
	assert.equal(input.getState().pointer.isDown, false);
	assert.equal(input.getState().pointer.target, null);
	assert.deepEqual(input.getState().pointer.path, []);
	assert.equal(cancellations.length, 1);
});
