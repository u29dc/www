import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Frame } from '../../src/app/core/module';
import { createRenderer, type State } from '../../src/app/graphics/canvas';
import { device } from '../../src/app/systems/device';
import { logo } from '../../src/app/ui/logo';

type Failure = 'shader-source' | 'fragment' | 'link' | 'buffer' | 'buffer-data' | 'vao' | 'uniform' | undefined;
type Resource = { kind: 'shader' | 'program' | 'buffer' | 'vao'; type?: number };

class FakeGl {
	readonly VERTEX_SHADER = 1;
	readonly FRAGMENT_SHADER = 2;
	readonly COMPILE_STATUS = 3;
	readonly LINK_STATUS = 4;
	readonly NO_ERROR = 0;
	readonly created = new Set<Resource>();
	readonly deleted = new Set<Resource>();
	readonly reads: Array<{ width: number; height: number }> = [];
	readonly mousePositions: Array<{ x: number; y: number }> = [];
	draws = 0;
	blank = false;
	error = 0;

	constructor(readonly failure?: Failure) {}
	private resource(kind: Resource['kind'], type?: number): Resource {
		const resource: Resource = { kind, ...(type === undefined ? {} : { type }) };
		this.created.add(resource);
		return resource;
	}
	getContextAttributes() {
		return { alpha: true };
	}
	createShader(type: number) {
		return this.resource('shader', type);
	}
	shaderSource() {
		if (this.failure === 'shader-source') throw new Error('Injected shader source failure');
	}
	compileShader() {}
	getShaderParameter(shader: Resource) {
		return !(this.failure === 'fragment' && shader.type === this.FRAGMENT_SHADER);
	}
	getShaderInfoLog() {
		return 'Injected shader failure';
	}
	deleteShader(resource: Resource) {
		this.deleted.add(resource);
	}
	createProgram() {
		return this.resource('program');
	}
	attachShader() {}
	linkProgram() {}
	getProgramParameter() {
		return this.failure !== 'link';
	}
	getProgramInfoLog() {
		return 'Injected link failure';
	}
	deleteProgram(resource: Resource) {
		this.deleted.add(resource);
	}
	useProgram() {}
	enable() {}
	blendFunc() {}
	disable() {}
	createBuffer() {
		return this.failure === 'buffer' ? null : this.resource('buffer');
	}
	bindBuffer() {}
	bufferData() {
		if (this.failure === 'buffer-data') throw new Error('Injected buffer data failure');
	}
	deleteBuffer(resource: Resource) {
		this.deleted.add(resource);
	}
	getAttribLocation() {
		return 0;
	}
	createVertexArray() {
		return this.failure === 'vao' ? null : this.resource('vao');
	}
	bindVertexArray() {}
	deleteVertexArray(resource: Resource) {
		this.deleted.add(resource);
	}
	vertexAttribPointer() {}
	enableVertexAttribArray() {}
	getUniformLocation(_program: Resource, name: string) {
		return { name };
	}
	uniform1f() {
		if (this.failure === 'uniform') throw new Error('Injected uniform failure');
	}
	uniform2f(location: { name: string }, x: number, y: number) {
		if (location.name === 'u_mouse') this.mousePositions.push({ x, y });
	}
	uniform3f() {}
	viewport() {}
	getError() {
		return this.error;
	}
	clearColor() {}
	clear() {}
	drawArrays() {
		this.draws++;
	}
	readPixels(_x: number, _y: number, width: number, height: number, _format: number, _type: number, pixels: Uint8Array) {
		this.reads.push({ width, height });
		if (!this.blank) for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
	}
}

const state: State = {
	width: 100,
	height: 50,
	blurStart: 1.5,
	defaultBlurIntensity: 0.4,
	mouseBlurIntensity: 0.25,
	mouseBlurSize: 0.3,
	roundness: 0.5,
	noiseIntensity: 0.1,
	noiseScale: 0.5,
	theme: 'light',
};

const installBrowser = (context: TestContext, gl = new FakeGl()) => {
	const geometry = { reads: 0, left: 0, top: 0 };
	const canvas = Object.assign(new EventTarget(), {
		width: 0,
		height: 0,
		hidden: true,
		style: {} as Record<string, string>,
		getContext: () => gl,
		getBoundingClientRect: () => {
			geometry.reads++;
			return { left: geometry.left, top: geometry.top };
		},
	});
	const fallback = { hidden: false, style: {} as Record<string, string>, dataset: {} as Record<string, string> };
	const element = {
		dataset: { width: '100', mobileWidth: '100', enableObservation: 'false' } as Record<string, string>,
		querySelector: (selector: string) => (selector === '[data-logo-canvas]' ? canvas : fallback),
	};
	const queries: string[] = [];
	const window = Object.assign(new EventTarget(), {
		devicePixelRatio: 2,
		innerWidth: 1280,
		innerHeight: 800,
		matchMedia: (query: string) => {
			queries.push(query);
			return Object.assign(new EventTarget(), { matches: query.includes('hover: hover') });
		},
	});
	const replacements: Record<string, unknown> = {
		window,
		document: Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', documentElement: { dataset: { theme: 'light' } }, querySelectorAll: () => [element] }),
		navigator: { hardwareConcurrency: 12, deviceMemory: 8 },
		CSS: { supports: () => true },
		ResizeObserver: undefined,
		PerformanceObserver: undefined,
	};
	const originals = new Map(Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, value });
	context.after(() => {
		logo.dispose();
		device.dispose();
		for (const [key, descriptor] of originals) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	});
	return { gl, canvas: canvas as unknown as HTMLCanvasElement, fallback, element, queries, geometry };
};

for (const failure of ['shader-source', 'fragment', 'link', 'buffer', 'buffer-data', 'vao', 'uniform'] as const) {
	test(`constructor releases every allocated resource after ${failure} failure`, (context) => {
		const { canvas, gl } = installBrowser(context, new FakeGl(failure));
		assert.throws(() => createRenderer(canvas, state, undefined, { diagnosticsMode: 'critical' }));
		assert.deepEqual(gl.deleted, gl.created);
	});
}

test('production checks only a 3x3 region once and settled updates do not redraw', (context) => {
	const { canvas, gl } = installBrowser(context);
	const renderer = createRenderer(canvas, state, undefined, { diagnosticsMode: 'critical' });
	assert.equal(renderer.renderOnce(), true);
	assert.deepEqual(gl.reads, [{ width: 3, height: 3 }]);
	renderer.start();
	const initialDraws = gl.draws;
	for (let index = 0; index < 100; index++) assert.equal(renderer.update(index * 16, 0.016), false);
	assert.equal(gl.draws, initialDraws);
	renderer.setPointer(75, 25);
	assert.equal(renderer.update(1600, 0.016), true);
	assert.ok(gl.draws > initialDraws);
	for (let index = 0; index < 200; index++) renderer.update(1600 + index * 16, 0.016);
	const settledDraws = gl.draws;
	renderer.update(5000, 0.016);
	assert.equal(gl.draws, settledDraws);
	assert.equal(gl.reads.length, 1);
	renderer.setState({ ...state, theme: 'dark' });
	assert.ok(gl.draws > settledDraws);
	const themedDraws = gl.draws;
	renderer.resize({ width: 100, height: 50 });
	assert.equal(gl.draws, themedDraws);
	renderer.resize({ width: 200, height: 100 });
	assert.ok(gl.draws > themedDraws);
	renderer.dispose();
	renderer.dispose();
	assert.deepEqual(gl.deleted, gl.created);
});

test('blank first draw preserves the static logo and releases resources', (context) => {
	const { canvas, fallback, element, gl } = installBrowser(context);
	gl.blank = true;
	device.initProfile({ calibrate: false });
	logo.init();
	assert.equal(canvas.hidden, true);
	assert.equal(fallback.hidden, false);
	assert.equal(element.dataset['failed'], 'true');
	assert.deepEqual(gl.deleted, gl.created);
});

test('successful first draw reveals canvas; context loss restores fallback', (context) => {
	const { canvas, fallback, gl, queries } = installBrowser(context);
	device.initProfile({ calibrate: false });
	logo.init();
	assert.equal(canvas.hidden, false);
	assert.equal(fallback.hidden, true);
	assert.deepEqual(gl.reads, [{ width: 3, height: 3 }]);
	assert.ok(queries.includes('(width < 42rem)'));
	const event = new Event('webglcontextlost', { cancelable: true });
	canvas.dispatchEvent(event);
	assert.equal(event.defaultPrevented, true);
	assert.equal(canvas.hidden, true);
	assert.equal(fallback.hidden, false);
	assert.deepEqual(gl.deleted, gl.created);
});

test('reduced motion restores static fallback and healthy capability remounts', (context) => {
	const { canvas, fallback } = installBrowser(context);
	device.initProfile({ calibrate: false });
	logo.init();
	const profile = device.getProfile();
	const frame = { now: 100, dt: 0.016, visible: true, profile, theme: { scheme: 'light' }, input: { pointer: { path: [] } } } as unknown as Frame;
	logo.update({ ...frame, profile: { ...profile, generation: profile.generation + 1, allowWebglMotion: false, motionQuality: 'reduced' } });
	assert.equal(canvas.hidden, true);
	assert.equal(fallback.hidden, false);
	logo.update({ ...frame, profile: { ...profile, generation: profile.generation + 2 } });
	assert.equal(canvas.hidden, false);
	assert.equal(fallback.hidden, true);
});

test('logo samples pointer geometry only after movement, scrolling, entry, resize or renderer replacement', (context) => {
	const { element, geometry, gl } = installBrowser(context);
	device.initProfile({ calibrate: false });
	logo.init();
	const profile = device.getProfile();
	const frame = {
		now: 100,
		dt: 0.016,
		visible: true,
		profile,
		theme: { scheme: 'light' },
		input: { pointer: { path: [element], x: 75, y: 25 } },
		scroll: { actual: 0 },
	} as unknown as Frame;
	logo.update(frame);
	assert.equal(geometry.reads, 1);
	for (let index = 0; index < 200; index++) logo.update({ ...frame, now: 100 + index * 16 });
	assert.equal(geometry.reads, 1, 'damping and unrelated settled frames reuse pointer geometry');
	assert.deepEqual(gl.mousePositions.at(-1), { x: 75, y: 25 });

	frame.input.pointer.x = 80;
	logo.update(frame);
	assert.equal(geometry.reads, 2);

	geometry.top = -20;
	frame.scroll.actual = 20;
	logo.update(frame);
	assert.equal(geometry.reads, 3, 'scrolling resamples the stationary pointer');
	for (let index = 0; index < 200; index++) logo.update(frame);
	assert.equal(geometry.reads, 3);
	assert.deepEqual(gl.mousePositions.at(-1), { x: 80, y: 45 });

	logo.resize();
	logo.update(frame);
	assert.equal(geometry.reads, 4);
	frame.input.pointer.path = [];
	logo.update(frame);
	frame.input.pointer.path = [element as unknown as EventTarget];
	logo.update(frame);
	assert.equal(geometry.reads, 5, 're-entry invalidates the sample');

	logo.update({ ...frame, profile: { ...profile, generation: profile.generation + 1, allowWebglMotion: false, motionQuality: 'reduced' } });
	logo.update({ ...frame, profile: { ...profile, generation: profile.generation + 2 } });
	assert.equal(geometry.reads, 6, 'a remounted renderer receives its own pointer sample');
});
