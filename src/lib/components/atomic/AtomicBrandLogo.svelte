<script lang="ts">
import { onMount } from 'svelte';
import { logEvent } from '$lib/logger';
import { registerRafTask } from '$lib/raf';

export interface AtomicBrandLogoProps {
	width?: number;
	blurStart?: number;
	defaultBlurIntensity?: number;
	mouseBlurIntensity?: number;
	mouseBlurSize?: number;
	roundness?: number;
	noiseIntensity?: number;
	noiseScale?: number;
	animateNoise?: boolean;
	className?: string;
	theme?: 'light' | 'dark' | 'system';
	observeVisibility?: boolean;
}

type ThemeVariant = 'light' | 'dark';
type DeviceTier = 'high' | 'medium' | 'low';

interface AtomicBrandLogoState {
	width: number;
	height: number;
	blurStart: number;
	defaultBlurIntensity: number;
	mouseBlurIntensity: number;
	mouseBlurSize: number;
	roundness: number;
	noiseIntensity: number;
	noiseScale: number;
	animateNoise: boolean;
	theme: ThemeVariant;
}

interface CanvasDimensions {
	width: number;
	height: number;
	dpr: number;
	pixelWidth: number;
	pixelHeight: number;
}

interface BufferDescriptor {
	buffer: WebGLBuffer;
	itemSize: number;
	itemCount: number;
}

interface AtomicBrandLogoRenderer {
	resize(dimensions?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>): void;
	setState(state: AtomicBrandLogoState): void;
	start(): void;
	stop(): void;
	renderOnce(): void;
	dispose(): void;
}

const UNIFORM_NAMES = [
	'u_mouse',
	'u_resolution',
	'u_pixelRatio',
	'u_rectWidth',
	'u_rectHeight',
	'u_roundness',
	'u_blurStart',
	'u_defaultBlurIntensity',
	'u_mouseBlurSize',
	'u_mouseBlurIntensity',
	'u_widthSpreadMultiplier',
	'u_heightSpreadMultiplier',
	'u_color',
	'u_noiseIntensity',
	'u_noiseScale',
	'u_time',
] as const;

const VERTEX_SHADER = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_position;

void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_mouse;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

uniform float u_rectWidth;
uniform float u_rectHeight;
uniform float u_roundness;
uniform float u_blurStart;
uniform float u_defaultBlurIntensity;
uniform float u_mouseBlurSize;
uniform float u_mouseBlurIntensity;
uniform float u_widthSpreadMultiplier;
uniform float u_heightSpreadMultiplier;
uniform vec3 u_color;

uniform float u_noiseIntensity;
uniform float u_noiseScale;
uniform float u_time;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec2 coord(in vec2 p) {
	p = p / u_resolution.xy;
	if (u_resolution.x > u_resolution.y) {
		p.x *= u_resolution.x / u_resolution.y;
		p.x += (u_resolution.y - u_resolution.x) / u_resolution.y / 2.0;
	} else {
		p.y *= u_resolution.y / u_resolution.x;
		p.y += (u_resolution.x - u_resolution.y) / u_resolution.x / 2.0;
	}
	p -= 0.5;
	p *= vec2(-1.0, 1.0);
	return p;
}

float sdRoundRectCorners(vec2 p, vec2 b, float rightRadius) {
	vec2 centered = (p - 0.5) * 4.2;

	float r = 0.0;
	if (centered.x < 0.0) {
		r = rightRadius;
	}

	vec2 d = abs(centered) - b + vec2(r);
	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

float sdCircle(in vec2 st, in vec2 center) {
	return length(st - center) * 2.0;
}

float aastep(float threshold, float value) {
	float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
	return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

float fill(in float x) {
	return 1.0 - aastep(0.0, x);
}

float fill(float x, float size, float edge) {
	return 1.0 - smoothstep(size - edge, size + edge, x);
}

void main() {
	vec2 st = coord(gl_FragCoord.xy) + 0.5;
	vec2 posMouse = coord(u_mouse * u_pixelRatio) * vec2(1.0, -1.0) + 0.5;

	float horizontalBlur = 0.0;
	float rightGradient = 0.0;
	if (st.x < u_blurStart) {
		float gradient = smoothstep(u_blurStart, 0.0, st.x);
		horizontalBlur = pow(gradient, 2.0) * u_defaultBlurIntensity;
		rightGradient = gradient;
	}

	float mouseBlurBase = fill(sdCircle(st, posMouse), u_mouseBlurSize, 1.0) * u_mouseBlurIntensity;
	float mouseBlurModulated = mouseBlurBase * mix(0.1, 1.0, rightGradient);

	float combinedBlur = clamp(horizontalBlur + mouseBlurModulated, 0.0, 1.0);
	float spreadFactor = pow(combinedBlur * rightGradient, 1.0);

	vec2 rectSize = vec2(u_rectWidth, u_rectHeight);
	float baseSdf = sdRoundRectCorners(st, rectSize, u_roundness);
	float baseAlpha = fill(baseSdf, 0.0, combinedBlur);

	float widthSpread = spreadFactor * u_widthSpreadMultiplier;
	float heightSpread = spreadFactor * u_heightSpreadMultiplier;
	vec2 expandedSize = vec2(u_rectWidth + widthSpread, u_rectHeight + heightSpread);
	float expandedRoundness = u_roundness + spreadFactor * 0.5;
	float expandedSdf = sdRoundRectCorners(st, expandedSize, expandedRoundness);

	float haloEdge = clamp(combinedBlur + spreadFactor * 0.35, 0.0, 1.3);
	float haloAlpha = fill(expandedSdf, 0.0, haloEdge);

	float alphaCombined = max(baseAlpha, haloAlpha);
	float alpha = mix(baseAlpha, alphaCombined, clamp(rightGradient, 0.0, 1.0));

	vec2 noiseCoord = gl_FragCoord.xy / u_noiseScale;
	float grainValue = noise(noiseCoord);
	grainValue = (grainValue - 0.5) * 2.0;
	float grain = grainValue * u_noiseIntensity;

	vec3 noisyColor = clamp(u_color + vec3(grain), 0.0, 1.0);

	fragColor = vec4(noisyColor, alpha);
}
`;

const DEFAULT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
	alpha: true,
	antialias: true,
	desynchronized: true,
	powerPreference: 'high-performance',
	premultipliedAlpha: true,
	preserveDrawingBuffer: false,
};

function detectDeviceTier(): DeviceTier {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return 'high';
	}

	const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
	const cores = navigator.hardwareConcurrency ?? 4;
	const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

	if (prefersReducedMotion || memory <= 2 || cores <= 2) {
		return 'low';
	}
	if (memory <= 4 || cores <= 4) {
		return 'medium';
	}
	return 'high';
}

function getDprCap(): number {
	const tier = detectDeviceTier();
	if (tier === 'low') return 1;
	if (tier === 'medium') return 1.5;
	return 2;
}

function damp(current: number, target: number, smoothing: number, deltaTime: number): number {
	const clampSmoothing = smoothing ?? 10;
	const clampDeltaTime = deltaTime ?? 0.1;
	const exponent = -clampSmoothing * clampDeltaTime;
	const weight = 1 - Math.exp(exponent);
	const value = current * (1 - weight) + target * weight;
	if (Math.abs(value - target) < 0.001) {
		return target;
	}
	return value;
}

function hexToRgb(hex: string): [number, number, number] {
	const sanitized = hex.replace('#', '');
	const bigint = Number.parseInt(sanitized, 16);
	const r = ((bigint >> 16) & 255) / 255;
	const g = ((bigint >> 8) & 255) / 255;
	const b = (bigint & 255) / 255;
	return [r, g, b];
}

function readSystemTheme(): ThemeVariant {
	if (typeof document !== 'undefined') {
		const root = document.documentElement;
		if (root.classList.contains('dark')) return 'dark';
		if (root.classList.contains('light')) return 'light';
	}
	if (typeof window !== 'undefined') {
		return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return 'light';
}

function resolveTheme(theme: AtomicBrandLogoProps['theme'], systemTheme: ThemeVariant): ThemeVariant {
	if (theme && theme !== 'system') {
		return theme;
	}
	return systemTheme;
}

function createGraphicsContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
	const gl = canvas.getContext('webgl2', DEFAULT_CONTEXT_ATTRIBUTES);

	if (!gl) {
		const errorInstance = new Error('WebGL2 context unavailable');
		logEvent('WEBGL', 'CONTEXT', 'FAIL', {
			errorMessage: errorInstance.message,
			errorStack: errorInstance.stack,
		});
		throw new Error('WebGL2 is not supported on this device.');
	}

	return gl;
}

function measureCanvas(canvas: HTMLCanvasElement, width: number, height: number, dprCap: number): CanvasDimensions {
	const rect = canvas.getBoundingClientRect();
	const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
	const resolvedWidth = rect.width || width;
	const resolvedHeight = rect.height || height;

	return {
		width: resolvedWidth,
		height: resolvedHeight,
		dpr,
		pixelWidth: Math.floor(resolvedWidth * dpr),
		pixelHeight: Math.floor(resolvedHeight * dpr),
	};
}

function applyCanvasSize(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, dimensions: CanvasDimensions): void {
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

function createStaticBuffer(gl: WebGL2RenderingContext, data: Float32Array, itemSize: number): BufferDescriptor {
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

function createFullscreenQuad(gl: WebGL2RenderingContext): BufferDescriptor {
	const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

	return createStaticBuffer(gl, positions, 2);
}

function disposeBuffer(gl: WebGL2RenderingContext, descriptor: BufferDescriptor | null): void {
	if (!descriptor) return;
	gl.deleteBuffer(descriptor.buffer);
}

interface ShaderSources {
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

function createProgram(gl: WebGL2RenderingContext, sources: ShaderSources): WebGLProgram {
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

type UniformMap<TKeys extends readonly string[]> = {
	[Key in TKeys[number]]: WebGLUniformLocation | null;
};

function resolveUniforms<const TKeys extends readonly string[]>(gl: WebGL2RenderingContext, program: WebGLProgram, names: TKeys): UniformMap<TKeys> {
	const uniforms = {} as UniformMap<TKeys>;
	const missingUniforms: string[] = [];

	names.forEach((name) => {
		const location = gl.getUniformLocation(program, name);
		uniforms[name as TKeys[number]] = location;
		if (location === null) {
			missingUniforms.push(name);
		}
	});

	if (missingUniforms.length > 0) {
		logEvent('WEBGL', 'UNIFORM', 'WARN', {
			missingUniforms,
			totalRequested: names.length,
		});
	}

	return uniforms;
}

function setUniform1f(location: WebGLUniformLocation | null, value: number, gl: WebGL2RenderingContext): void {
	if (!location) return;
	gl.uniform1f(location, value);
}

function setUniform2f(location: WebGLUniformLocation | null, x: number, y: number, gl: WebGL2RenderingContext): void {
	if (!location) return;
	gl.uniform2f(location, x, y);
}

function setUniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number, gl: WebGL2RenderingContext): void {
	if (!location) return;
	gl.uniform3f(location, x, y, z);
}

function createAtomicBrandLogoRenderer(canvas: HTMLCanvasElement, initialState: AtomicBrandLogoState): AtomicBrandLogoRenderer {
	const gl = createGraphicsContext(canvas);
	const program = createProgram(gl, {
		vertex: VERTEX_SHADER,
		fragment: FRAGMENT_SHADER,
	});

	gl.useProgram(program);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.disable(gl.DEPTH_TEST);

	const fullscreenQuad = createFullscreenQuad(gl);
	const positionLocation = gl.getAttribLocation(program, 'a_position');
	if (positionLocation === -1) {
		logEvent('WEBGL', 'ATOMIC-LOGO', 'ATTRIB-MISSING', {
			attribute: 'a_position',
		});
	}

	const vao = gl.createVertexArray();
	if (!vao) {
		logEvent('WEBGL', 'ATOMIC-LOGO', 'VAO-MISSING');
		throw new Error('Failed to allocate vertex array.');
	}

	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
	gl.vertexAttribPointer(positionLocation, fullscreenQuad.itemSize, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(positionLocation);
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	const uniforms = resolveUniforms(gl, program, UNIFORM_NAMES);
	const dprCap = getDprCap();

	let state = { ...initialState };
	let dimensions = measureCanvas(canvas, state.width, state.height, dprCap);
	const mousePosition = {
		x: dimensions.width / 2,
		y: dimensions.height / 2,
	};
	const dampedMouse = { ...mousePosition };
	let hasPointerInteraction = false;
	let hasLoggedFirstFrame = false;

	const colorCache = new Map<string, [number, number, number]>();

	const checkGlError = (phase: string) => {
		const error = gl.getError();
		if (error !== gl.NO_ERROR) {
			logEvent('WEBGL', 'ATOMIC-LOGO', 'GL-ERROR', {
				phase,
				error,
			});
		}
	};

	const updateResolutionUniforms = (nextDimensions: CanvasDimensions) => {
		applyCanvasSize(canvas, gl, nextDimensions);
		setUniform2f(uniforms.u_resolution, nextDimensions.pixelWidth, nextDimensions.pixelHeight, gl);
		setUniform1f(uniforms.u_pixelRatio, nextDimensions.dpr, gl);
		checkGlError('updateResolutionUniforms');
	};

	const applyStaticUniforms = (current: AtomicBrandLogoState) => {
		setUniform1f(uniforms.u_rectWidth, 2.0, gl);
		setUniform1f(uniforms.u_rectHeight, 0.5, gl);
		setUniform1f(uniforms.u_roundness, current.roundness, gl);
		setUniform1f(uniforms.u_blurStart, current.blurStart, gl);
		setUniform1f(uniforms.u_defaultBlurIntensity, current.defaultBlurIntensity, gl);
		setUniform1f(uniforms.u_mouseBlurSize, current.mouseBlurSize, gl);
		setUniform1f(uniforms.u_mouseBlurIntensity, current.mouseBlurIntensity, gl);
		setUniform1f(uniforms.u_noiseIntensity, current.noiseIntensity, gl);
		setUniform1f(uniforms.u_noiseScale, current.noiseScale, gl);
		checkGlError('applyStaticUniforms');
	};

	const applyThemeUniforms = (variant: ThemeVariant) => {
		const widthMultiplier = 0.75;
		const heightMultiplier = variant === 'dark' ? 0.1 : 0.5;
		setUniform1f(uniforms.u_widthSpreadMultiplier, widthMultiplier, gl);
		setUniform1f(uniforms.u_heightSpreadMultiplier, heightMultiplier, gl);

		const colorHex = variant === 'dark' ? '#ffffff' : '#000000';
		const cached = colorCache.get(colorHex) ?? hexToRgb(colorHex);
		if (!colorCache.has(colorHex)) {
			colorCache.set(colorHex, cached);
		}
		setUniform3f(uniforms.u_color, cached[0], cached[1], cached[2], gl);
		checkGlError('applyThemeUniforms');
	};

	const updatePointer = (event: PointerEvent | MouseEvent) => {
		const rect = canvas.getBoundingClientRect();
		mousePosition.x = event.clientX - rect.left;
		mousePosition.y = event.clientY - rect.top;
		hasPointerInteraction = true;
	};

	const handlePointerMove = (event: PointerEvent | MouseEvent) => {
		updatePointer(event);
		checkGlError('pointerMove');
	};

	let isTracking = false;

	const handlePointerEnter = () => {
		if (!isTracking) {
			canvas.addEventListener('pointermove', handlePointerMove);
			canvas.addEventListener('mousemove', handlePointerMove);
			isTracking = true;
		}
	};

	const handlePointerLeave = () => {
		if (isTracking) {
			canvas.removeEventListener('pointermove', handlePointerMove);
			canvas.removeEventListener('mousemove', handlePointerMove);
			isTracking = false;
		}
	};

	canvas.addEventListener('pointerenter', handlePointerEnter);
	canvas.addEventListener('pointerleave', handlePointerLeave);

	applyStaticUniforms(state);
	applyThemeUniforms(state.theme);
	updateResolutionUniforms(dimensions);

	let isRunning = false;
	let isDisposed = false;
	let resizeObserver: ResizeObserver | null = null;

	const drawFrame = (timestamp: number, deltaSeconds: number) => {
		if (isDisposed) return;
		if (!hasLoggedFirstFrame) {
			hasLoggedFirstFrame = true;
			logEvent('WEBGL', 'ATOMIC-LOGO', 'FRAME-START', {
				delta: deltaSeconds * 1000,
				now: timestamp,
			});
		}

		dampedMouse.x = damp(dampedMouse.x, mousePosition.x, 8, deltaSeconds);
		dampedMouse.y = damp(dampedMouse.y, mousePosition.y, 8, deltaSeconds);

		gl.useProgram(program);
		gl.bindVertexArray(vao);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		setUniform2f(uniforms.u_mouse, dampedMouse.x, dampedMouse.y, gl);
		if (state.animateNoise) {
			setUniform1f(uniforms.u_time, timestamp * 0.0001, gl);
		}

		checkGlError('beforeDraw');

		gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.itemCount);
		gl.bindVertexArray(null);

		checkGlError('afterDraw');
	};

	const tick = (timestamp: number, deltaSeconds: number) => {
		if (!isRunning) return false;
		drawFrame(timestamp, deltaSeconds);
		return true;
	};

	const rafTask = registerRafTask(tick, { autoStart: false });

	const start = () => {
		if (isRunning || isDisposed) return;
		isRunning = true;
		rafTask.wake();
	};

	const stop = () => {
		if (!isRunning) return;
		isRunning = false;
		rafTask.sleep();
	};

	const renderOnce = () => {
		drawFrame(performance.now(), 0);
	};

	start();

	const handleResize = (overrides?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>) => {
		const targetWidth = overrides?.width ?? state.width;
		const targetHeight = overrides?.height ?? state.height;
		dimensions = measureCanvas(canvas, targetWidth, targetHeight, dprCap);
		gl.useProgram(program);
		updateResolutionUniforms(dimensions);

		if (!hasPointerInteraction) {
			mousePosition.x = dimensions.width / 2;
			mousePosition.y = dimensions.height / 2;
			dampedMouse.x = mousePosition.x;
			dampedMouse.y = mousePosition.y;
			return;
		}

		mousePosition.x = Math.min(Math.max(mousePosition.x, 0), dimensions.width);
		mousePosition.y = Math.min(Math.max(mousePosition.y, 0), dimensions.height);
	};

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			handleResize();
		});
		resizeObserver.observe(canvas);
	}

	const handleWindowResize = () => {
		handleResize();
	};

	if (typeof window !== 'undefined') {
		window.addEventListener('resize', handleWindowResize);
	}

	const resize = (nextDimensions?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>) => {
		handleResize(nextDimensions);
	};

	const setState = (nextState: AtomicBrandLogoState) => {
		const previousTheme = state.theme;
		state = { ...nextState };
		gl.useProgram(program);
		applyStaticUniforms(state);
		if (state.theme !== previousTheme) {
			applyThemeUniforms(state.theme);
		}
	};

	const dispose = () => {
		if (isDisposed) return;
		isDisposed = true;

		stop();
		rafTask.dispose();

		canvas.removeEventListener('pointerenter', handlePointerEnter);
		canvas.removeEventListener('pointerleave', handlePointerLeave);
		if (isTracking) {
			canvas.removeEventListener('pointermove', handlePointerMove);
			canvas.removeEventListener('mousemove', handlePointerMove);
		}

		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}

		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', handleWindowResize);
		}

		gl.bindVertexArray(null);
		gl.deleteVertexArray(vao);
		disposeBuffer(gl, fullscreenQuad);
		gl.deleteProgram(program);

		logEvent('WEBGL', 'RENDERER', 'DISPOSED');
	};

	return {
		resize,
		setState,
		start,
		stop,
		renderOnce,
		dispose,
	};
}

let {
	width = 200,
	blurStart = 1.0,
	defaultBlurIntensity = 0.5,
	mouseBlurIntensity = 1.0,
	mouseBlurSize = 0.5,
	roundness = 0.5,
	noiseIntensity = 0.15,
	noiseScale = 150,
	animateNoise = false,
	className = '',
	theme = 'system',
	observeVisibility = true,
}: AtomicBrandLogoProps = $props();

const height = $derived(width / 4);
const classValue = $derived(className);
const containerStyle = $derived(`width: ${width}px; height: ${height}px;`);
const canvasStyle = 'width: 100%; height: 100%; display: block;';

let canvasRef = $state<HTMLCanvasElement | null>(null);
let renderer = $state<AtomicBrandLogoRenderer | null>(null);
let resolvedTheme = $state<ThemeVariant>('light');
let isInView = $state(true);
let isPageVisible = $state(true);
let prefersReducedMotion = $state(false);
let deviceTier = $state<DeviceTier>('high');
let hasRenderedStatic = false;

const isActive = $derived(deviceTier !== 'low' && isPageVisible && !prefersReducedMotion && (observeVisibility ? isInView : true));

$effect(() => {
	resolvedTheme = resolveTheme(theme, readSystemTheme());
});

const buildState = (): AtomicBrandLogoState => ({
	width,
	height,
	blurStart,
	defaultBlurIntensity,
	mouseBlurIntensity,
	mouseBlurSize,
	roundness,
	noiseIntensity,
	noiseScale,
	animateNoise,
	theme: resolvedTheme,
});

onMount(() => {
	deviceTier = detectDeviceTier();

	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const updateMotionPreference = () => {
		prefersReducedMotion = motionQuery.matches;
	};
	updateMotionPreference();
	motionQuery.addEventListener('change', updateMotionPreference);

	const updatePageVisibility = () => {
		isPageVisible = document.visibilityState === 'visible';
	};
	updatePageVisibility();
	document.addEventListener('visibilitychange', updatePageVisibility);

	if (!canvasRef) {
		return () => {
			motionQuery.removeEventListener('change', updateMotionPreference);
			document.removeEventListener('visibilitychange', updatePageVisibility);
		};
	}

	resolvedTheme = resolveTheme(theme, readSystemTheme());
	const state = buildState();
	let mediaQuery: MediaQueryList | null = null;
	let handleMediaChange: (() => void) | null = null;

	if (theme === 'system' && typeof window !== 'undefined') {
		mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
		handleMediaChange = () => {
			resolvedTheme = resolveTheme(theme, readSystemTheme());
		};
		mediaQuery?.addEventListener('change', handleMediaChange);
	}

	try {
		renderer = createAtomicBrandLogoRenderer(canvasRef, state);
	} catch (error) {
		logEvent('WEBGL', 'ATOMIC-LOGO', 'INIT-FAIL', {
			message: error instanceof Error ? error.message : String(error),
		});
		return () => {
			mediaQuery?.removeEventListener('change', handleMediaChange ?? (() => {}));
			motionQuery.removeEventListener('change', updateMotionPreference);
			document.removeEventListener('visibilitychange', updatePageVisibility);
		};
	}

	return () => {
		renderer?.dispose();
		renderer = null;
		mediaQuery?.removeEventListener('change', handleMediaChange ?? (() => {}));
		motionQuery.removeEventListener('change', updateMotionPreference);
		document.removeEventListener('visibilitychange', updatePageVisibility);
	};
});

$effect(() => {
	if (!observeVisibility) {
		isInView = true;
		return;
	}
	if (!canvasRef) return;
	if (typeof IntersectionObserver === 'undefined') {
		isInView = true;
		return;
	}
	const observer = new IntersectionObserver(
		([entry]) => {
			isInView = entry?.isIntersecting ?? true;
		},
		{ rootMargin: '200px' },
	);
	observer.observe(canvasRef);
	return () => {
		observer.disconnect();
	};
});

$effect(() => {
	if (!renderer) return;
	if (isActive) {
		hasRenderedStatic = false;
		renderer.start();
		return;
	}
	renderer.stop();
	if (!hasRenderedStatic) {
		renderer.renderOnce();
		hasRenderedStatic = true;
	}
});

$effect(() => {
	if (!renderer) return;
	const nextState = buildState();
	renderer.setState(nextState);
	renderer.resize({ width: nextState.width, height: nextState.height });
	if (!isActive) {
		renderer.renderOnce();
		hasRenderedStatic = true;
	}
});
</script>

<div class={classValue} style={containerStyle}>
	<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
	<canvas bind:this={canvasRef} style={canvasStyle} aria-label="u29dc logo" role="img"></canvas>
</div>
