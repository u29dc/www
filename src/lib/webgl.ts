/**
 * WebGL Runtime Library
 *
 * ## SUMMARY
 * Consolidated utilities powering reusable WebGL renderers.
 *
 * ## RESPONSIBILITIES
 * - Provide context creation, DPR management, buffer helpers, and shader tooling
 * - Expose a renderer factory with lifecycle hooks and shared RAF/telemetry support
 * - Offer optional feature registry plus uniform convenience functions
 *
 * @module lib/webgl
 */

import type { LoggerInstance } from '@/lib/logger';
import { logger as rootLogger } from '@/lib/logger';

export interface GraphicsContext {
	gl: WebGL2RenderingContext;
	canvas: HTMLCanvasElement;
	attributes: WebGLContextAttributes;
}

export interface FrameInfo {
	now: number;
	delta: number;
}

export interface CanvasDimensions {
	width: number;
	height: number;
	dpr: number;
	pixelWidth: number;
	pixelHeight: number;
}

export interface ModuleInitContext<TState> {
	context: GraphicsContext;
	dimensions: CanvasDimensions;
	state: TState;
	logger: LoggerInstance;
	registerDisposer(disposer: () => void): void;
}

export interface ModuleLifecycle<TState> {
	onFrame?(info: FrameInfo, state: TState): void;
	onResize?(dimensions: CanvasDimensions): void;
	onStateChange?(state: TState, previous: TState): void;
	onDispose?(): void;
}

export interface RendererModule<TState> {
	id: string;
	onInit(context: ModuleInitContext<TState>): ModuleLifecycle<TState>;
}

export interface RendererHandle<TState> {
	start(): void;
	stop(): void;
	resize(dimensions?: Partial<Pick<CanvasDimensions, 'width' | 'height' | 'dpr'>>): void;
	setState(updater: TState | ((current: TState) => TState)): void;
	dispose(): void;
}

export interface GraphicsContextOptions {
	attributes?: WebGLContextAttributes;
}

export interface FrameMonitorOptions {
	windowSize?: number;
	warningThresholdMs?: number;
	sampleFloor?: number;
}

const FRAME_MONITOR_DEFAULTS: Required<FrameMonitorOptions> = {
	windowSize: 60,
	warningThresholdMs: 20,
	sampleFloor: 15,
};

export class FrameMonitor {
	private durations: number[] = [];
	private pointer = 0;
	private options: Required<FrameMonitorOptions>;
	private logger: LoggerInstance;

	constructor(logger: LoggerInstance, options: FrameMonitorOptions = {}) {
		this.logger = logger;
		this.options = {
			windowSize: options.windowSize ?? FRAME_MONITOR_DEFAULTS.windowSize,
			warningThresholdMs:
				options.warningThresholdMs ?? FRAME_MONITOR_DEFAULTS.warningThresholdMs,
			sampleFloor: options.sampleFloor ?? FRAME_MONITOR_DEFAULTS.sampleFloor,
		};
		this.durations = new Array(this.options.windowSize).fill(0);
	}

	record(durationMs: number): void {
		this.durations[this.pointer] = durationMs;
		this.pointer = (this.pointer + 1) % this.options.windowSize;

		const samples = this.durations.filter((value) => value > 0);
		if (samples.length < this.options.sampleFloor) return;

		const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
		if (average > this.options.warningThresholdMs) {
			this.logger.warn('[webgl|frame|slow]', {
				averageDurationMs: Math.round(average * 100) / 100,
				samples,
			});
		}
	}
}

type RafCallback = (timestamp: number) => void;

export class RafManager {
	private callbacks: Set<RafCallback> = new Set();
	private rafId: number | null = null;

	subscribe(callback: RafCallback): () => void {
		this.callbacks.add(callback);
		this.ensureRunning();
		return () => this.unsubscribe(callback);
	}

	private unsubscribe(callback: RafCallback): void {
		this.callbacks.delete(callback);
		if (this.callbacks.size === 0 && this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	private run = (timestamp: number) => {
		this.rafId = requestAnimationFrame(this.run);
		this.callbacks.forEach((callback) => {
			callback(timestamp);
		});
	};

	private ensureRunning(): void {
		if (this.rafId === null) {
			this.rafId = requestAnimationFrame(this.run);
		}
	}
}

export const rafManager = typeof window !== 'undefined' ? new RafManager() : null;

type FeatureFactory<TState, TConfig> = (config: TConfig) => RendererModule<TState>;

class FeatureRegistry<TState> {
	private factories = new Map<string, FeatureFactory<TState, unknown>>();

	register<TConfig>(id: string, factory: FeatureFactory<TState, TConfig>): void {
		if (this.factories.has(id)) {
			throw new Error(`WebGL feature "${id}" already registered.`);
		}
		this.factories.set(id, factory as FeatureFactory<TState, unknown>);
	}

	createModules(requests: FeatureRequest[]): RendererModule<TState>[] {
		return requests.map(({ id, config }) => {
			const factory = this.factories.get(id);
			if (!factory) {
				throw new Error(`WebGL feature "${id}" is not registered.`);
			}
			return factory(config);
		});
	}
}

export interface FeatureRequest {
	id: string;
	config: unknown;
}

const featureRegistry = new FeatureRegistry<unknown>();

export function registerFeature<TState, TConfig>(
	id: string,
	factory: FeatureFactory<TState, TConfig>,
): void {
	(featureRegistry as FeatureRegistry<TState>).register(id, factory);
}

export function resolveFeatureModules<TState>(
	requests: FeatureRequest[],
): RendererModule<TState>[] {
	return (featureRegistry as FeatureRegistry<TState>).createModules(requests);
}

const DEFAULT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
	alpha: true,
	antialias: true,
	desynchronized: true,
	powerPreference: 'high-performance',
	premultipliedAlpha: true,
	preserveDrawingBuffer: false,
};

export function createGraphicsContext(
	canvas: HTMLCanvasElement,
	options: GraphicsContextOptions = {},
): GraphicsContext {
	const attributes: WebGLContextAttributes = {
		...DEFAULT_CONTEXT_ATTRIBUTES,
		...options.attributes,
	};

	const gl = canvas.getContext('webgl2', attributes);

	if (!gl) {
		rootLogger.error('[webgl|context|fail]', new Error('WebGL2 context unavailable'));
		throw new Error('WebGL2 is not supported on this device.');
	}

	return {
		gl,
		canvas,
		attributes,
	};
}

const DEFAULT_DPR_CAP = 2;

export function measureCanvas(
	canvas: HTMLCanvasElement,
	dprCap = DEFAULT_DPR_CAP,
): CanvasDimensions {
	const rect = canvas.getBoundingClientRect();
	const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
	const dpr = Math.min(deviceDpr, dprCap);

	const width = rect.width || canvas.width || canvas.clientWidth;
	const height = rect.height || canvas.height || canvas.clientHeight;

	const pixelWidth = Math.floor(width * dpr);
	const pixelHeight = Math.floor(height * dpr);

	return {
		width,
		height,
		dpr,
		pixelWidth,
		pixelHeight,
	};
}

export function applyCanvasSize(context: GraphicsContext, dimensions: CanvasDimensions): void {
	const { canvas, gl } = context;
	const { width, height, pixelWidth, pixelHeight } = dimensions;

	if (canvas.width !== pixelWidth) {
		canvas.width = pixelWidth;
	}
	if (canvas.height !== pixelHeight) {
		canvas.height = pixelHeight;
	}

	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;

	gl.viewport(0, 0, pixelWidth, pixelHeight);
}

export interface BufferDescriptor {
	buffer: WebGLBuffer;
	itemSize: number;
	itemCount: number;
}

export function createStaticBuffer(
	gl: WebGL2RenderingContext,
	data: Float32Array,
	itemSize: number,
): BufferDescriptor {
	const buffer = gl.createBuffer();
	if (!buffer) {
		throw new Error('Failed to create buffer.');
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

	return {
		buffer,
		itemSize,
		itemCount: data.length / itemSize,
	};
}

export function createFullscreenQuad(gl: WebGL2RenderingContext): BufferDescriptor {
	const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

	return createStaticBuffer(gl, positions, 2);
}

export function disposeBuffer(
	gl: WebGL2RenderingContext,
	descriptor: BufferDescriptor | null,
): void {
	if (!descriptor) return;
	gl.deleteBuffer(descriptor.buffer);
}

export interface ShaderSources {
	vertex: string;
	fragment: string;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to allocate shader.');
	}

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (!success) {
		const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error.';
		gl.deleteShader(shader);
		throw new Error(log);
	}

	return shader;
}

export function createProgram(context: GraphicsContext, sources: ShaderSources): WebGLProgram {
	const { gl } = context;
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, sources.vertex);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, sources.fragment);

	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		throw new Error('Failed to allocate shader program.');
	}

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	const success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (!success) {
		const log = gl.getProgramInfoLog(program) ?? 'Unknown shader linking error.';
		gl.deleteProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		throw new Error(log);
	}

	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	return program;
}

export type UniformMap<TKeys extends readonly string[]> = {
	[Key in TKeys[number]]: WebGLUniformLocation | null;
};

export function resolveUniforms<const TKeys extends readonly string[]>(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	names: TKeys,
): UniformMap<TKeys> {
	const uniforms = {} as UniformMap<TKeys>;
	names.forEach((name) => {
		uniforms[name as TKeys[number]] = gl.getUniformLocation(program, name);
	});
	return uniforms;
}

export function setUniform1f(
	location: WebGLUniformLocation | null,
	value: number,
	gl: WebGL2RenderingContext,
): void {
	if (!location) return;
	gl.uniform1f(location, value);
}

export function setUniform2f(
	location: WebGLUniformLocation | null,
	x: number,
	y: number,
	gl: WebGL2RenderingContext,
): void {
	if (!location) return;
	gl.uniform2f(location, x, y);
}

export function setUniform3f(
	location: WebGLUniformLocation | null,
	x: number,
	y: number,
	z: number,
	gl: WebGL2RenderingContext,
): void {
	if (!location) return;
	gl.uniform3f(location, x, y, z);
}

export interface RendererOptions<TState> {
	canvas: HTMLCanvasElement;
	modules: RendererModule<TState>[];
	initialState: TState;
	contextAttributes?: WebGLContextAttributes;
	dprCap?: number;
	autoStart?: boolean;
	autoResize?: boolean;
	telemetry?: boolean;
	logger?: LoggerInstance;
	telemetryOptions?: FrameMonitorOptions;
	label?: string;
}

export function createRenderer<TState>(options: RendererOptions<TState>): RendererHandle<TState> {
	const {
		canvas,
		modules,
		initialState,
		contextAttributes,
		dprCap,
		autoStart = true,
		autoResize = true,
		telemetry = true,
		logger,
		telemetryOptions,
		label = 'renderer',
	} = options;

	const scopedLogger = (logger ?? rootLogger).child({ domain: 'webgl', label });
	const context = createGraphicsContext(
		canvas,
		contextAttributes ? { attributes: contextAttributes } : undefined,
	);
	const frameMonitor = telemetry
		? new FrameMonitor(scopedLogger.child({ scope: 'frame' }), telemetryOptions)
		: null;

	let state = initialState;
	let previousState = initialState;
	let dimensions: CanvasDimensions = measureCanvas(canvas, dprCap);
	applyCanvasSize(context, dimensions);

	const disposers = new Set<() => void>();
	const lifecycle: ModuleLifecycle<TState>[] = modules.map((module) => {
		const moduleLogger = scopedLogger.child({ module: module.id });
		return module.onInit({
			context,
			dimensions,
			state,
			logger: moduleLogger,
			registerDisposer(disposer) {
				disposers.add(disposer);
			},
		});
	});

	let isRunning = false;
	let isDisposed = false;
	let lastTimestamp = 0;
	let rafRelease: (() => void) | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let windowResizeListener: (() => void) | null = null;

	const notifyResize = (nextDimensions: CanvasDimensions) => {
		dimensions = nextDimensions;
		lifecycle.forEach((moduleRuntime) => {
			moduleRuntime.onResize?.(nextDimensions);
		});
	};

	const resize = (overrides?: Partial<Pick<CanvasDimensions, 'width' | 'height' | 'dpr'>>) => {
		if (isDisposed) return;

		const current = measureCanvas(canvas, dprCap);
		const width = overrides?.width ?? current.width;
		const height = overrides?.height ?? current.height;
		const dpr = overrides?.dpr ?? current.dpr;
		const merged: CanvasDimensions = {
			width,
			height,
			dpr,
			pixelWidth: Math.floor(width * dpr),
			pixelHeight: Math.floor(height * dpr),
		};

		applyCanvasSize(context, merged);
		notifyResize(merged);
	};

	const tick = (timestamp: number) => {
		if (isDisposed || !isRunning) return;

		if (lastTimestamp === 0) {
			lastTimestamp = timestamp;
		}

		const delta = timestamp - lastTimestamp;
		lastTimestamp = timestamp;
		const frame: FrameInfo = {
			now: timestamp,
			delta,
		};

		lifecycle.forEach((moduleRuntime) => {
			moduleRuntime.onFrame?.(frame, state);
		});

		frameMonitor?.record(delta);
	};

	const start = () => {
		if (isDisposed || isRunning) return;
		if (typeof window === 'undefined') {
			scopedLogger.warn('[webgl|renderer|noop]', { reason: 'window-unavailable' });
			return;
		}

		isRunning = true;
		lastTimestamp = 0;

		if (rafManager) {
			rafRelease = rafManager.subscribe(tick);
		} else {
			let frameId = requestAnimationFrame(function loop(time) {
				tick(time);
				frameId = requestAnimationFrame(loop);
			});
			rafRelease = () => {
				cancelAnimationFrame(frameId);
			};
		}
	};

	const stop = () => {
		if (!isRunning) return;
		isRunning = false;
		rafRelease?.();
		rafRelease = null;
	};

	const setState = (updater: TState | ((current: TState) => TState)) => {
		if (isDisposed) return;
		previousState = state;
		state =
			typeof updater === 'function'
				? (updater as (current: TState) => TState)(state)
				: updater;
		lifecycle.forEach((moduleRuntime) => {
			moduleRuntime.onStateChange?.(state, previousState);
		});
	};

	const dispose = () => {
		if (isDisposed) return;
		stop();
		isDisposed = true;

		lifecycle.forEach((moduleRuntime) => {
			moduleRuntime.onDispose?.();
		});

		disposers.forEach((disposer) => {
			try {
				disposer();
			} catch (error) {
				scopedLogger.error('[webgl|dispose|error]', error);
			}
		});
		disposers.clear();

		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (windowResizeListener) {
			window.removeEventListener('resize', windowResizeListener);
		}

		if (context.gl.isContextLost()) {
			scopedLogger.warn('[webgl|context|lost]');
		}
	};

	if (autoResize && typeof window !== 'undefined') {
		const globalWindow = window as Window & typeof globalThis;
		const maybeResizeObserver = (globalWindow as { ResizeObserver?: typeof ResizeObserver })
			.ResizeObserver;

		if (typeof maybeResizeObserver === 'function') {
			resizeObserver = new maybeResizeObserver(() => resize());
			resizeObserver.observe(canvas);
			disposers.add(() => resizeObserver?.disconnect());
		} else {
			const resizeHandler = () => resize();
			globalWindow.addEventListener('resize', resizeHandler);
			windowResizeListener = resizeHandler;
			disposers.add(() => {
				if (windowResizeListener) {
					globalWindow.removeEventListener('resize', windowResizeListener);
					windowResizeListener = null;
				}
			});
		}
	}

	const handle: RendererHandle<TState> = {
		start,
		stop,
		resize,
		setState,
		dispose,
	};

	if (autoStart) {
		start();
	}

	return handle;
}
