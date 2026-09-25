import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { App, type AppConfig, type RuntimeDiagnostics } from '../../src/app/core/app';
import { BaseModule, type Context, type Frame, type Module } from '../../src/app/core/module';
import { cancelRuntimeTimers, delayTimer, setTimer, setTimerScheduler } from '../../src/app/core/timer';
import { subscribeTheme, theme } from '../../src/app/systems/theme';

class BrowserHarness {
	readonly cleanups: Array<() => void> = [];
	readonly frames = new Map<number, FrameRequestCallback>();
	readonly timers = new Map<number, () => void>();
	readonly root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
	readonly query = Object.assign(new EventTarget(), { matches: false });
	readonly meta = { dataset: {} as Record<string, string>, name: '', content: '' };
	readonly document = Object.assign(new EventTarget(), {
		visibilityState: 'visible',
		documentElement: this.root,
		querySelector: () => this.meta,
		createElement: () => this.meta,
		head: { append: () => {} },
	});
	readonly window = Object.assign(new EventTarget(), {
		matchMedia: () => this.query,
		setTimeout: (callback: () => void): number => {
			const id = this.nextId++;
			this.timers.set(id, callback);
			return id;
		},
		clearTimeout: (id: number): void => {
			this.timers.delete(id);
		},
		wwwRuntimeDiagnostics: undefined as (() => RuntimeDiagnostics) | undefined,
	});
	private nextId = 1;

	install(context: TestContext): this {
		const globals = {
			window: this.window,
			document: this.document,
			requestAnimationFrame: (callback: FrameRequestCallback): number => {
				const id = this.nextId++;
				this.frames.set(id, callback);
				return id;
			},
			cancelAnimationFrame: (id: number): void => {
				this.frames.delete(id);
			},
		};
		const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
		for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
		context.after(() => {
			try {
				for (const cleanup of this.cleanups.toReversed()) cleanup();
				cancelRuntimeTimers();
			} finally {
				for (const [key, descriptor] of previous) {
					if (descriptor) Object.defineProperty(globalThis, key, descriptor);
					else Reflect.deleteProperty(globalThis, key);
				}
			}
		});
		return this;
	}

	start(modules: Module[], overrides: Partial<AppConfig> = {}): App {
		const app = new App(modules, createConfig(overrides));
		this.cleanups.push(() => app.dispose());
		app.start();
		return app;
	}

	frame(timestamp = 16): void {
		const callbacks = [...this.frames.values()];
		this.frames.clear();
		for (const callback of callbacks) callback(timestamp);
	}

	expireTimers(): void {
		const callbacks = [...this.timers.values()];
		this.timers.clear();
		for (const callback of callbacks) callback();
	}

	setVisibility(visibility: 'visible' | 'hidden'): void {
		this.document.visibilityState = visibility;
		this.document.dispatchEvent(new Event('visibilitychange'));
	}

	diagnostics(): RuntimeDiagnostics {
		assert.ok(this.window.wwwRuntimeDiagnostics);
		return this.window.wwwRuntimeDiagnostics();
	}
}

const createConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
	getProfile: () => ({
		version: 1,
		source: 'fallback',
		confidence: 'low',
		generation: 0,
		updatedAt: 0,
		tier: 'low',
		motionQuality: 'reduced',
		inputProfile: 'unknown',
		networkProfile: 'unknown',
		displayProfile: 'standard',
		dprCap: 1,
		lineProfile: 'lite',
		allowWebglMotion: false,
		allowWebglHighDpr: false,
		allowHoverVideo: false,
		allowPixelReveal: false,
		allowContentVisibility: false,
		reasons: [],
		signals: { clientReady: true, reducedMotion: true, coarsePointer: false, finePointer: false, hover: false, devicePixelRatio: 1, viewportWidth: 1024, viewportHeight: 768 },
	}),
	getRoute: () => ({ current: 'home', pathname: '/', hash: '', page: 'loaded', pageState: 'loaded', generation: 0 }),
	getInput: () => ({
		generation: 0,
		pointer: {
			x: 0,
			y: 0,
			nx: 0,
			ny: 0,
			dx: 0,
			dy: 0,
			vx: 0,
			vy: 0,
			isDown: false,
			wasPressed: false,
			wasReleased: false,
			activePointerType: '',
			target: null,
			relatedTarget: null,
			path: [],
			exited: false,
		},
		wheel: { dx: 0, dy: 0, source: 'none' },
		keyboard: { lastKey: '', hadKeyboardInput: false, activeKeys: [] },
	}),
	getScroll: () => ({ actual: 0, animated: 0, target: 0, velocity: 0, direction: 0, limit: 0, active: false, source: 'native', enabled: false }),
	getTheme: () => ({ scheme: 'light', mode: 'system', generation: 0 }),
	...overrides,
});

const fail = (): never => {
	throw new TypeError('test-only sensitive detail');
};

const previousDiagnostics = (): RuntimeDiagnostics => ({ version: 1, running: false, frame: 0, pendingCallbacks: 0, errors: [] });

test('owners initialize in phases, share one frame, and wake again after becoming idle', (context) => {
	const browser = new BrowserHarness().install(context);
	const calls: string[] = [];
	const frames: Frame[] = [];
	const modules = ['first', 'second'].map((name): Module => ({
		name,
		preinit: () => calls.push(`${name}:preinit`),
		init: () => calls.push(`${name}:init`),
		resize: () => calls.push(`${name}:resize`),
		update: (frame) => {
			calls.push(`${name}:update`);
			frames.push(frame);
		},
	}));
	const app = browser.start(modules);
	app.requestFrame('second-request');
	assert.equal(browser.frames.size, 1);
	assert.deepEqual(calls, ['first:preinit', 'second:preinit', 'first:init', 'second:init', 'first:resize', 'second:resize']);
	browser.frame();
	assert.equal(frames[0], frames[1]);
	assert.equal(browser.frames.size, 0);
	app.requestFrame('wake');
	browser.frame(10_000);
	assert.equal(frames[2]?.dt, 0);
	assert.equal(browser.frames.size, 0);
});

test('callbacks requested during a frame run on the next frame and delta is capped', (context) => {
	const browser = new BrowserHarness().install(context);
	const frames: Frame[] = [];
	const calls: string[] = [];
	const app = browser.start([
		{
			name: 'owner',
			update: (frame) => {
				frames.push(frame);
			},
		},
	]);
	app.nextFrame('first', () => {
		calls.push('first');
		app.nextFrame('second', () => {
			calls.push('second');
		});
	});
	browser.frame(16);
	assert.deepEqual(calls, ['first']);
	assert.equal(browser.frames.size, 1);
	browser.frame(1_016);
	assert.deepEqual(calls, ['first', 'second']);
	assert.equal(frames[1]?.rawdt, 1000);
	assert.equal(frames[1]?.dt, 0.064);
	assert.equal(browser.frames.size, 0);
});

test('hidden documents defer work and visibility restoration resets delta', (context) => {
	const browser = new BrowserHarness().install(context);
	const frames: Frame[] = [];
	const app = browser.start([
		{
			name: 'owner',
			update: (frame) => {
				frames.push(frame);
			},
		},
	]);
	browser.frame();
	browser.setVisibility('hidden');
	app.requestFrame('hidden-request');
	assert.equal(browser.frames.size, 0);
	browser.setVisibility('visible');
	browser.frame(20_000);
	assert.equal(frames.length, 2);
	assert.equal(frames[1]?.dt, 0);
});

test('a frame-state read failure leaves the scheduler available for the next request', (context) => {
	const browser = new BrowserHarness().install(context);
	let failRead = true;
	let updates = 0;
	const app = browser.start(
		[
			{
				name: 'owner',
				update: () => {
					updates += 1;
				},
			},
		],
		{
			getTheme: () => {
				if (failRead) throw new Error('state unavailable');
				return { scheme: 'light', mode: 'system', generation: 0 };
			},
		},
	);
	browser.frame();
	assert.equal(updates, 0);
	assert.equal(browser.diagnostics().errors[0]?.phase, 'frame');
	failRead = false;
	app.requestFrame('recovered');
	browser.frame(32);
	assert.equal(updates, 1);
	assert.equal(browser.frames.size, 0);
});

test('cancelling a callback already selected for the frame still prevents its execution', (context) => {
	const browser = new BrowserHarness().install(context);
	const app = browser.start([]);
	let called = false;
	let cancel: (() => void) | undefined;
	app.nextFrame('cancel', () => cancel?.());
	cancel = app.nextFrame('cancelled', () => {
		called = true;
	});
	browser.frame();
	assert.equal(called, false);
	assert.equal(browser.diagnostics().pendingCallbacks, 0);
});

test('faults in lifecycle, callbacks, owners and frame hooks do not strand other work', (context) => {
	const browser = new BrowserHarness().install(context);
	const calls: string[] = [];
	const app = browser.start(
		[
			{ name: 'broken', preinit: fail, init: fail, resize: fail, update: fail, dispose: fail },
			{
				name: 'healthy',
				init: () => calls.push('init'),
				update: () => {
					calls.push('update');
				},
				dispose: () => calls.push('dispose'),
			},
		],
		{ beforeFrame: fail, afterFrame: fail },
	);
	app.nextFrame('broken.callback', fail);
	app.nextFrame('healthy.callback', () => {
		calls.push('callback');
	});
	browser.frame();
	app.requestFrame('retry');
	browser.frame(32);
	assert.deepEqual(calls, ['init', 'callback', 'update', 'update']);
	assert.equal(browser.frames.size, 0);
	const snapshot = browser.diagnostics();
	assert.equal(snapshot.errors.find((error) => error.owner === 'broken' && error.phase === 'update')?.count, 2);
	assert.deepEqual(new Set(snapshot.errors.map((error) => error.phase)), new Set(['preinit', 'init', 'resize', 'callback', 'update', 'beforeFrame', 'afterFrame']));
	assert.equal(JSON.stringify(snapshot).includes('sensitive'), false);
	app.dispose();
	assert.equal(calls.at(-1), 'dispose');
	assert.equal(browser.window.wwwRuntimeDiagnostics, undefined);
});

test('production diagnostics are bounded, copy snapshots and exclude callback/error payloads', (context) => {
	const browser = new BrowserHarness().install(context);
	const app = browser.start(
		Array.from({ length: 25 }, (_, index): Module => ({
			name: `owner${index}`,
			update: () => {
				throw new Error('private-message');
			},
		})),
	);
	app.nextFrame('https://private.example/path', () => {
		throw { privateData: 'secret' };
	});
	browser.frame();
	const snapshot = browser.diagnostics();
	assert.equal(snapshot.errors.length, 20);
	assert.equal(snapshot.errors[0]?.owner, 'owner5');
	assert.doesNotMatch(JSON.stringify(snapshot), /private|secret|https/);
	const first = snapshot.errors[0];
	assert.ok(first);
	first.count = 999;
	assert.equal(browser.diagnostics().errors[0]?.count, 1);
});

test('cancelling an expired timer removes its callback while the document is hidden', (context) => {
	const browser = new BrowserHarness().install(context);
	const calls: string[] = [];
	browser.start([]);
	browser.frame();
	browser.setVisibility('hidden');
	for (let index = 0; index < 30; index += 1) {
		const timer = setTimer('cancelled', 1, () => {
			calls.push('timer');
		});
		browser.expireTimers();
		assert.equal(browser.diagnostics().pendingCallbacks, 1);
		timer.cancel();
		assert.equal(browser.diagnostics().pendingCallbacks, 0);
		assert.equal(timer.active(), false);
	}
	browser.setVisibility('visible');
	browser.frame(32);
	assert.deepEqual(calls, []);
});

test('timer cancellation calls scheduler cancellation and settles aborted delays once', async (context) => {
	const browser = new BrowserHarness().install(context);
	let scheduled: (() => void) | undefined;
	let cancellationCount = 0;
	let callbackCount = 0;
	const reset = setTimerScheduler((_name, callback) => {
		scheduled = callback;
		return () => {
			cancellationCount += 1;
		};
	});
	browser.cleanups.push(reset);
	const timer = setTimer('cancel', 1, () => {
		callbackCount += 1;
	});
	browser.expireTimers();
	timer.cancel();
	timer.cancel();
	scheduled?.();
	assert.equal(cancellationCount, 1);
	assert.equal(callbackCount, 0);
	const abort = new AbortController();
	let settled = 0;
	const delay = delayTimer('abort', 1, abort.signal).then(() => {
		settled += 1;
	});
	browser.expireTimers();
	abort.abort();
	await delay;
	scheduled?.();
	assert.equal(settled, 1);
	assert.equal(cancellationCount, 2);
});

test('timer cleanup failures do not prevent other timers being cancelled', (context) => {
	new BrowserHarness().install(context);
	const calls: string[] = [];
	const first = setTimer('first', 1, () => {}, {
		onCancel: () => {
			calls.push('first');
			throw new Error('first');
		},
	});
	const second = setTimer('second', 1, () => {}, {
		onCancel: () => {
			calls.push('second');
			throw new Error('second');
		},
	});
	assert.throws(cancelRuntimeTimers, AggregateError);
	assert.deepEqual(calls, ['first', 'second']);
	assert.equal(first.active(), false);
	assert.equal(second.active(), false);
});

test('module cleanups all run, disposal reverses owners, and previous diagnostics are restored', (context) => {
	const browser = new BrowserHarness().install(context);
	const calls: string[] = [];
	browser.window.wwwRuntimeDiagnostics = previousDiagnostics;
	class Owner extends BaseModule {
		readonly name = 'first';
		override preinit(runtime: Context): void {
			super.preinit(runtime);
			this.addCleanup(() => {
				calls.push('first:cleanup1');
				throw new Error('cleanup1');
			});
			this.addCleanup(() => {
				calls.push('first:cleanup2');
			});
		}
	}
	const app = browser.start([
		new Owner(),
		{
			name: 'second',
			dispose: () => {
				calls.push('second:dispose');
			},
		},
	]);
	setTimer('pending', 1, () => {
		calls.push('timer');
	});
	app.dispose();
	browser.expireTimers();
	browser.frame();
	assert.deepEqual(calls, ['second:dispose', 'first:cleanup1', 'first:cleanup2']);
	assert.equal(browser.window.wwwRuntimeDiagnostics, previousDiagnostics);
	assert.equal(browser.frames.size, 0);
});

test('a failing theme subscriber cannot block later subscribers or frame requests', (context) => {
	const browser = new BrowserHarness().install(context);
	browser.start([theme]);
	browser.frame();
	const schemes: string[] = [];
	const unsubscribeFailure = subscribeTheme(() => {
		throw new Error('subscriber');
	});
	const unsubscribeHealthy = subscribeTheme((state) => {
		schemes.push(state.scheme);
	});
	assert.deepEqual(schemes, ['light']);
	browser.query.matches = true;
	browser.query.dispatchEvent(new Event('change'));
	assert.deepEqual(schemes, ['light', 'dark']);
	assert.equal(browser.frames.size, 1);
	assert.equal(browser.diagnostics().errors.find((error) => error.owner === 'theme' && error.phase === 'reported')?.count, 2);
	unsubscribeFailure();
	unsubscribeHealthy();
	browser.query.matches = false;
	browser.query.dispatchEvent(new Event('change'));
	assert.deepEqual(schemes, ['light', 'dark']);
});
