import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Frame } from '../../src/app/core/module';
import { DEVICE_THRESHOLDS, device } from '../../src/app/systems/device';

const installBrowser = (context: TestContext, effectiveType = '4g') => {
	let now = 100;
	let nextTimer = 0;
	let idle: (() => void) | undefined;
	let observeTasks: ((list: { getEntries: () => Array<{ startTime: number; duration: number }> }) => void) | undefined;
	const timers = new Map<number, { callback: () => void; dueAt: number }>();
	const root = { dataset: {}, clientWidth: 1280, clientHeight: 800 };
	const document = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', documentElement: root });
	const connection = Object.assign(new EventTarget(), { effectiveType, saveData: false });
	const window = Object.assign(new EventTarget(), {
		innerWidth: 1280,
		innerHeight: 800,
		devicePixelRatio: 2,
		matchMedia: (query: string) => Object.assign(new EventTarget(), { matches: query.includes('hover: hover') }),
		requestIdleCallback: (callback: () => void) => {
			idle = callback;
			return 1;
		},
		cancelIdleCallback: () => {},
		setTimeout: (callback: () => void, delay: number) => {
			const id = ++nextTimer;
			timers.set(id, { callback, dueAt: now + delay });
			return id;
		},
		clearTimeout: (id: number) => timers.delete(id),
	});
	const replacements: Record<string, unknown> = {
		document,
		window,
		navigator: { hardwareConcurrency: 12, deviceMemory: 8, connection },
		CSS: { supports: () => true },
		performance: { now: () => now },
		PerformanceObserver: class {
			constructor(callback: typeof observeTasks) {
				observeTasks = callback;
			}
			observe() {}
			disconnect() {}
		},
	};
	const originals = new Map(Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value });
	context.after(() => {
		device.dispose();
		for (const [key, descriptor] of originals) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	});
	device.initProfile();
	return {
		startCalibration: () => idle?.(),
		frame: (elapsed = 1000 / 60) => {
			now += elapsed;
			return device.update({ now, visible: !document.hidden } as Frame);
		},
		setHidden: (hidden: boolean) => {
			document.hidden = hidden;
			document.visibilityState = hidden ? 'hidden' : 'visible';
			document.dispatchEvent(new Event('visibilitychange'));
		},
		tasks: (count: number) => observeTasks?.({ getEntries: () => Array.from({ length: count }, () => ({ startTime: now - 51, duration: 51 })) }),
		advance: (elapsed: number) => {
			now += elapsed;
			for (const [id, timer] of timers) {
				if (timer.dueAt <= now) {
					timers.delete(id);
					timer.callback();
				}
			}
		},
		connection,
	};
};

test('calibration uses a new contiguous visible sample after backgrounding', (context) => {
	const browser = installBrowser(context);
	browser.startCalibration();
	for (let index = 0; index < 8; index++) browser.frame();
	browser.setHidden(true);
	browser.advance(10_000);
	browser.setHidden(false);
	for (let index = 0; index <= DEVICE_THRESHOLDS.calibrationFrames; index++) browser.frame();
	assert.equal(device.getProfile().tier, 'high');
	assert.ok(Math.abs((device.getProfile().signals.rafFps ?? 0) - 60) < 0.01);
});

test('initially hidden calibration collects no hidden-frame timestamps', (context) => {
	const browser = installBrowser(context);
	browser.setHidden(true);
	browser.startCalibration();
	assert.equal(browser.frame(10_000), false);
	browser.setHidden(false);
	for (let index = 0; index <= DEVICE_THRESHOLDS.calibrationFrames; index++) browser.frame();
	assert.equal(device.getProfile().tier, 'high');
	assert.ok(Math.abs((device.getProfile().signals.rafFps ?? 0) - 60) < 0.01);
});

test('long-task penalties expire and recover without another external event', (context) => {
	const browser = installBrowser(context);
	browser.tasks(8);
	assert.equal(device.getProfile().tier, 'low');
	assert.equal(device.getProfile().allowWebglMotion, false);
	browser.advance(DEVICE_THRESHOLDS.longTaskWindowMs + 1);
	assert.equal(device.getProfile().tier, 'high');
	assert.equal(device.getProfile().allowWebglMotion, true);
	assert.equal(device.getProfile().signals.longTaskCount, undefined);
});

test('only recent long tasks contribute to a later degradation', (context) => {
	const browser = installBrowser(context);
	browser.tasks(5);
	assert.equal(device.getProfile().tier, 'medium');
	browser.advance(DEVICE_THRESHOLDS.longTaskWindowMs + 1);
	browser.tasks(3);
	assert.equal(device.getProfile().tier, 'medium');
	assert.equal(device.getProfile().signals.longTaskCount, 3);
});

test('temporary long tasks recover to a calibrated medium baseline', (context) => {
	const browser = installBrowser(context);
	browser.startCalibration();
	for (let index = 0; index <= DEVICE_THRESHOLDS.calibrationFrames; index++) browser.frame(20);
	assert.equal(device.getProfile().tier, 'medium');
	browser.tasks(8);
	assert.equal(device.getProfile().tier, 'low');
	browser.advance(DEVICE_THRESHOLDS.longTaskWindowMs + 1);
	assert.equal(device.getProfile().tier, 'medium');
	assert.equal(device.getProfile().allowWebglMotion, true);
});

test('slow network suppresses hover video and connection recovery restores eligibility', (context) => {
	const browser = installBrowser(context, '2g');
	assert.equal(device.getProfile().networkProfile, 'slow');
	assert.equal(device.getProfile().allowHoverVideo, false);
	browser.connection.effectiveType = '4g';
	browser.connection.dispatchEvent(new Event('change'));
	assert.equal(device.getProfile().allowHoverVideo, true);
});
