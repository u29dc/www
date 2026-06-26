export type Theme = 'light' | 'dark';

export interface State {
	width: number;
	height: number;
	blurStart: number;
	defaultBlurIntensity: number;
	mouseBlurIntensity: number;
	mouseBlurSize: number;
	roundness: number;
	noiseIntensity: number;
	noiseScale: number;
	theme: Theme;
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

export interface Renderer {
	resize(dimensions?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>): void;
	setState(state: State): void;
	setPointer(x: number, y: number): void;
	start(): void;
	stop(): void;
	update(timestamp: number, deltaSeconds: number): boolean;
	renderOnce(): void;
	dispose(): void;
}

export type RendererOptions = {
	diagnosticsMode?: WebglDiagnosticsMode;
	dprCap?: number;
};

export type WebglDiagnosticsMode = 'off' | 'critical' | 'full';

type DiagnosticValue = string | number | boolean | null;
type DiagnosticPayload = Record<string, DiagnosticValue>;

const STORAGE_DIAGNOSTICS_KEY = 'u29dc:webgl:diagnostics:astro';
const MAX_DIAGNOSTIC_EVENTS = 50;

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const canUseStorage = (): boolean => {
	if (!inBrowser()) return false;
	try {
		return typeof window.localStorage !== 'undefined';
	} catch {
		return false;
	}
};

const isDevelopment = (): boolean => import.meta.env.DEV;

export function getWebglDiagnosticsMode(): WebglDiagnosticsMode {
	if (isDevelopment()) return 'full';
	return 'critical';
}

function shouldRunFullWebglDiagnostics(mode: WebglDiagnosticsMode = getWebglDiagnosticsMode()): boolean {
	return mode === 'full';
}

function shouldRecordWebglDiagnostics(mode: WebglDiagnosticsMode = getWebglDiagnosticsMode()): boolean {
	return mode !== 'off';
}

export const recordWebglDiagnostic = ({ feature, stage, result, data, mode }: { feature: 'logo'; stage: string; result: string; data?: DiagnosticPayload; mode?: WebglDiagnosticsMode }): void => {
	if (!canUseStorage() || !shouldRecordWebglDiagnostics(mode)) return;

	const event = {
		feature,
		stage,
		result,
		data: data ?? {},
		timestamp: Date.now(),
		build: 'astro',
	};

	try {
		const raw = window.localStorage.getItem(STORAGE_DIAGNOSTICS_KEY);
		const parsed = raw ? (JSON.parse(raw) as unknown) : [];
		const list = Array.isArray(parsed) ? parsed : [];
		list.push(event);
		if (list.length > MAX_DIAGNOSTIC_EVENTS) {
			list.splice(0, list.length - MAX_DIAGNOSTIC_EVENTS);
		}
		window.localStorage.setItem(STORAGE_DIAGNOSTICS_KEY, JSON.stringify(list));
	} catch {
		// Storage may be disabled; diagnostics must never affect rendering.
	}
};

const logEvent = (scope: string, topic: string, event: string, data?: Record<string, unknown>): void => {
	const diagnosticData: Record<string, string | number | boolean | null> = {};
	if (data) {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
				diagnosticData[key] = value;
				continue;
			}
			diagnosticData[key] = JSON.stringify(value) ?? String(value);
		}
	}

	recordWebglDiagnostic({
		feature: 'logo',
		stage: `${scope.toLowerCase()}:${topic.toLowerCase()}`,
		result: event,
		data: diagnosticData,
	});
};

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
] as const;

export const LOGO_VERTEX_SHADER = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_position;

void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const LOGO_FRAGMENT_SHADER = /* glsl */ `#version 300 es
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

// -----------------------------------------------------------------
// Hash function: converts 2D input to pseudo-random scalar
// Uses fract-based scrambling with prime-like multipliers for
// good distribution. Output range [0, 1].
// -----------------------------------------------------------------
float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

// -----------------------------------------------------------------
// Value noise: smooth interpolation of hash values at grid corners.
// Uses Hermite smoothing (3t^2 - 2t^3) for C1 continuity.
// Output range [0, 1].
// -----------------------------------------------------------------
float noise(vec2 p) {
	vec2 i = floor(p);          // Integer grid cell
	vec2 f = fract(p);          // Fractional position within cell
	vec2 u = f * f * (3.0 - 2.0 * f);  // Hermite smoothstep

	// Sample hash at four grid corners
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	// Bilinear interpolation
	return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// -----------------------------------------------------------------
// Coordinate normalization: maps pixel coordinates to normalized
// space with aspect ratio correction. Centers origin and flips X
// for left-to-right blur gradient direction.
// -----------------------------------------------------------------
vec2 coord(in vec2 p) {
	p = p / u_resolution.xy;
	// Aspect ratio correction: expand shorter axis to fill [0,1]
	if (u_resolution.x > u_resolution.y) {
		p.x *= u_resolution.x / u_resolution.y;
		p.x += (u_resolution.y - u_resolution.x) / u_resolution.y / 2.0;
	} else {
		p.y *= u_resolution.y / u_resolution.x;
		p.y += (u_resolution.x - u_resolution.y) / u_resolution.x / 2.0;
	}
	p -= 0.5;              // Center origin
	p *= vec2(-1.0, 1.0);  // Flip X for blur gradient direction
	return p;
}

// -----------------------------------------------------------------
// Signed Distance Function: rounded rectangle with asymmetric corners.
// Right side has rounded corners (radius = rightRadius), left is sharp.
// Scale factor 2.3 maps normalized coords to logo proportions (scaled for 2:1 canvas, slightly smaller).
// Returns: negative inside, zero on edge, positive outside.
// -----------------------------------------------------------------
float sdRoundRectCorners(vec2 p, vec2 b, float rightRadius) {
	vec2 centered = (p - vec2(0.65, 0.5)) * 2.3;  // Offset X to shift logo left (X is flipped in coord())

	// Apply radius only to left side (centered.x < 0 after flip)
	float r = 0.0;
	if (centered.x < 0.0) {
		r = rightRadius;
	}

	// Standard rounded box SDF formula
	vec2 d = abs(centered) - b + vec2(r);
	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

// -----------------------------------------------------------------
// Circle SDF for mouse blur effect: simple distance from center.
// -----------------------------------------------------------------
float sdCircle(in vec2 st, in vec2 center) {
	return length(st - center) * 2.0;
}

// -----------------------------------------------------------------
// Anti-aliased step: uses screen-space derivatives for smooth edges.
// The magic number 0.707... is 1/sqrt(2) for diagonal gradient length.
// -----------------------------------------------------------------
float aastep(float threshold, float value) {
	float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
	return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

// -----------------------------------------------------------------
// Fill functions: convert SDF to alpha mask.
// - fill(x): hard fill with anti-aliasing
// - fill(x, size, edge): soft fill with controllable blur edge
// -----------------------------------------------------------------
float fill(in float x) {
	return 1.0 - aastep(0.0, x);
}

float fill(float x, float size, float edge) {
	return 1.0 - smoothstep(size - edge, size + edge, x);
}

void main() {
	vec2 st = coord(gl_FragCoord.xy) + 0.5;
	vec2 posMouse = coord(u_mouse * u_pixelRatio) * vec2(1.0, -1.0) + 0.5;

	// --- LEFT-SIDE BLUR GRADIENT ---
	// Creates blur that increases toward left edge (low st.x values)
	float horizontalBlur = 0.0;
	float rightGradient = 0.0;
	if (st.x < u_blurStart) {
		float gradient = smoothstep(u_blurStart, 0.0, st.x);
		horizontalBlur = pow(gradient, 2.0) * u_defaultBlurIntensity;  // Quadratic falloff
		rightGradient = gradient;  // Used for halo spread calculation
	}

	// --- MOUSE-INFLUENCED BLUR ---
	// Circular blur region follows cursor, modulated by position in blur zone
	float mouseBlurBase = fill(sdCircle(st, posMouse), u_mouseBlurSize, 1.0) * u_mouseBlurIntensity;
	float mouseBlurModulated = mouseBlurBase * mix(0.1, 1.0, rightGradient);

	// --- COMBINED BLUR & SPREAD ---
	float combinedBlur = clamp(horizontalBlur + mouseBlurModulated, 0.0, 1.0);
	float spreadFactor = pow(combinedBlur * rightGradient, 1.0);  // Halo expansion amount

	// --- BASE LOGO SDF ---
	vec2 rectSize = vec2(u_rectWidth, u_rectHeight);
	float baseSdf = sdRoundRectCorners(st, rectSize, u_roundness);
	float baseAlpha = fill(baseSdf, 0.0, combinedBlur);

	// --- EXPANDED HALO ---
	// Larger, more rounded rectangle for glow effect
	float widthSpread = spreadFactor * u_widthSpreadMultiplier;
	float heightSpread = spreadFactor * u_heightSpreadMultiplier;
	vec2 expandedSize = vec2(u_rectWidth + widthSpread, u_rectHeight + heightSpread);
	float expandedRoundness = u_roundness + spreadFactor * 0.5;
	float expandedSdf = sdRoundRectCorners(st, expandedSize, expandedRoundness);

	float haloEdge = clamp(combinedBlur + spreadFactor * 0.35, 0.0, 1.3);
	float haloAlpha = fill(expandedSdf, 0.0, haloEdge);

	// --- FINAL ALPHA ---
	// Blend base and halo, weighted by position in blur zone
	float alphaCombined = max(baseAlpha, haloAlpha);
	float alpha = mix(baseAlpha, alphaCombined, clamp(rightGradient, 0.0, 1.0));

	// --- GRAIN OVERLAY ---
	// Value noise scaled to pixel coordinates for film-like texture
	vec2 noiseCoord = gl_FragCoord.xy / u_noiseScale;
	float grainValue = noise(noiseCoord);
	grainValue = (grainValue - 0.5) * 2.0;  // Remap [0,1] to [-1,1]
	float grain = grainValue * u_noiseIntensity;

	vec3 noisyColor = clamp(u_color + vec3(grain), 0.0, 1.0);

	fragColor = vec4(noisyColor, alpha);
}
`;

const DEFAULT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
	alpha: true,
	antialias: true,
	desynchronized: false,
	powerPreference: 'default',
	premultipliedAlpha: true,
	preserveDrawingBuffer: false,
};

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

	const contextAttributes = gl.getContextAttributes();
	if (!contextAttributes?.alpha) {
		logEvent('WEBGL', 'CONTEXT', 'UNSAFE_ALPHA', {
			alpha: contextAttributes?.alpha ?? null,
			desynchronized: contextAttributes?.desynchronized ?? null,
		});
		throw new Error('WebGL context does not expose alpha; logo overlay disabled.');
	}

	return gl;
}

function measureCanvas(width: number, height: number, dprCap: number): CanvasDimensions {
	const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

	return {
		width,
		height,
		dpr,
		pixelWidth: Math.floor(width * dpr),
		pixelHeight: Math.floor(height * dpr),
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

	const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
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

	const success = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
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

export function createRenderer(
	canvas: HTMLCanvasElement,
	initialState: State,
	onFatalContextError?: (reason: 'context-lost' | 'context-restored' | 'gl-error') => void,
	options: RendererOptions = {},
): Renderer {
	const diagnosticsMode = options.diagnosticsMode ?? getWebglDiagnosticsMode();
	const gl = createGraphicsContext(canvas);
	const program = createProgram(gl, {
		vertex: LOGO_VERTEX_SHADER,
		fragment: LOGO_FRAGMENT_SHADER,
	});

	gl.useProgram(program);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.disable(gl.DEPTH_TEST);

	const fullscreenQuad = createFullscreenQuad(gl);
	const positionLocation = gl.getAttribLocation(program, 'a_position');
	if (positionLocation === -1) {
		logEvent('WEBGL', 'LOGO', 'ATTRIB-MISSING', {
			attribute: 'a_position',
		});
	}

	const vao = gl.createVertexArray();
	if (!vao) {
		logEvent('WEBGL', 'LOGO', 'VAO-MISSING');
		throw new Error('Failed to allocate vertex array.');
	}

	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
	gl.vertexAttribPointer(positionLocation, fullscreenQuad.itemSize, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(positionLocation);
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	const uniforms = resolveUniforms(gl, program, UNIFORM_NAMES);
	const dprCap = options.dprCap ?? 1.5;

	let state = { ...initialState };
	let dimensions = measureCanvas(state.width, state.height, dprCap);
	const mousePosition = {
		x: dimensions.width / 2,
		y: dimensions.height / 2,
	};
	const dampedMouse = { ...mousePosition };
	let hasPointerInteraction = false;
	let hasLoggedFirstFrame = false;
	let hasValidatedFrame = false;
	let hasContextFailure = false;

	const colorCache = new Map<string, [number, number, number]>();

	const failOnContextError = (reason: 'context-lost' | 'context-restored' | 'gl-error', message: string): void => {
		if (hasContextFailure) return;
		hasContextFailure = true;
		logEvent('WEBGL', 'LOGO', 'FAIL', { reason, message });
		onFatalContextError?.(reason);
	};

	const checkGlError = (phase: string): boolean => {
		if (!shouldRunFullWebglDiagnostics(diagnosticsMode)) return true;

		const error = gl.getError();
		if (error !== gl.NO_ERROR) {
			logEvent('WEBGL', 'LOGO', 'GL-ERROR', {
				phase,
				error,
			});
			if (phase === 'beforeDraw' || phase === 'afterDraw' || phase === 'updateResolutionUniforms' || phase === 'validateFrame') {
				failOnContextError('gl-error', `Critical GL error (${error}) during ${phase}`);
				return false;
			}
		}
		return true;
	};

	const handleContextLost = (event: Event): void => {
		const contextEvent = event as WebGLContextEvent;
		contextEvent.preventDefault();
		failOnContextError('context-lost', contextEvent.statusMessage || 'WebGL context lost');
	};

	const handleContextRestored = (): void => {
		failOnContextError('context-restored', 'WebGL context restored unexpectedly');
	};

	const updateResolutionUniforms = (nextDimensions: CanvasDimensions): void => {
		applyCanvasSize(canvas, gl, nextDimensions);
		setUniform2f(uniforms.u_resolution, nextDimensions.pixelWidth, nextDimensions.pixelHeight, gl);
		setUniform1f(uniforms.u_pixelRatio, nextDimensions.dpr, gl);
		checkGlError('updateResolutionUniforms');
	};

	const applyStaticUniforms = (current: State): void => {
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

	const applyThemeUniforms = (variant: Theme): void => {
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

	const setPointer = (clientX: number, clientY: number): void => {
		const rect = canvas.getBoundingClientRect();
		mousePosition.x = clientX - rect.left;
		mousePosition.y = clientY - rect.top;
		hasPointerInteraction = true;
	};

	canvas.addEventListener('webglcontextlost', handleContextLost, {
		passive: false,
	});
	canvas.addEventListener('webglcontextrestored', handleContextRestored);

	applyStaticUniforms(state);
	applyThemeUniforms(state.theme);
	updateResolutionUniforms(dimensions);

	let isRunning = false;
	let isDisposed = false;
	let resizeObserver: ResizeObserver | null = null;

	const drawFrame = (timestamp: number, deltaSeconds: number): void => {
		if (isDisposed || hasContextFailure) return;
		if (!hasLoggedFirstFrame) {
			hasLoggedFirstFrame = true;
			logEvent('WEBGL', 'LOGO', 'FRAME-START', {
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
		if (!checkGlError('beforeDraw')) return;

		gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.itemCount);
		gl.bindVertexArray(null);

		if (!checkGlError('afterDraw')) return;
		validateFrameOutput();
	};

	const update = (timestamp: number, deltaSeconds: number): boolean => {
		if (!isRunning || isDisposed || hasContextFailure) {
			return false;
		}
		drawFrame(timestamp, deltaSeconds);
		return shouldAnimate();
	};

	function shouldAnimate(): boolean {
		return Math.abs(dampedMouse.x - mousePosition.x) > 0.001 || Math.abs(dampedMouse.y - mousePosition.y) > 0.001;
	}

	function validateFrameOutput(): void {
		if (!shouldRunFullWebglDiagnostics(diagnosticsMode)) return;
		if (hasValidatedFrame || hasContextFailure) return;
		hasValidatedFrame = true;

		const { pixelWidth, pixelHeight } = dimensions;
		if (pixelWidth <= 0 || pixelHeight <= 0) {
			failOnContextError('gl-error', 'Logo canvas has an empty backing buffer.');
			return;
		}

		const pixels = new Uint8Array(pixelWidth * pixelHeight * 4);
		gl.readPixels(0, 0, pixelWidth, pixelHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		let alphaSum = 0;
		for (let index = 3; index < pixels.length; index += 4) {
			alphaSum += pixels[index] ?? 0;
		}

		if (!checkGlError('validateFrame')) return;
		if (alphaSum <= 0) {
			failOnContextError('gl-error', 'Logo rendered a fully transparent frame.');
			return;
		}

		logEvent('WEBGL', 'LOGO', 'FRAME-VALIDATED', {
			alphaSum,
			pixelWidth,
			pixelHeight,
		});
	}

	const start = (): void => {
		if (isRunning || isDisposed) return;
		isRunning = true;
		renderOnce();
	};

	const stop = (): void => {
		if (!isRunning) return;
		isRunning = false;
	};

	const renderOnce = (): void => {
		drawFrame(performance.now(), 0);
	};

	const handleResize = (overrides?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>): void => {
		const targetWidth = overrides?.width ?? state.width;
		const targetHeight = overrides?.height ?? state.height;
		dimensions = measureCanvas(targetWidth, targetHeight, dprCap);
		gl.useProgram(program);
		updateResolutionUniforms(dimensions);

		if (!hasPointerInteraction) {
			mousePosition.x = dimensions.width / 2;
			mousePosition.y = dimensions.height / 2;
			dampedMouse.x = mousePosition.x;
			dampedMouse.y = mousePosition.y;
			if (isRunning) renderOnce();
			return;
		}

		mousePosition.x = Math.min(Math.max(mousePosition.x, 0), dimensions.width);
		mousePosition.y = Math.min(Math.max(mousePosition.y, 0), dimensions.height);
		if (isRunning) {
			renderOnce();
		}
	};

	if (typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			handleResize();
		});
		resizeObserver.observe(canvas);
	} else if (typeof window !== 'undefined') {
		window.addEventListener('resize', handleWindowResize);
	}

	function handleWindowResize(): void {
		handleResize();
	}

	const resize = (nextDimensions?: Partial<Pick<CanvasDimensions, 'width' | 'height'>>): void => {
		handleResize(nextDimensions);
	};

	const setState = (nextState: State): void => {
		const previousTheme = state.theme;
		state = { ...nextState };
		gl.useProgram(program);
		applyStaticUniforms(state);
		if (state.theme !== previousTheme) {
			applyThemeUniforms(state.theme);
		}
		if (isRunning) {
			renderOnce();
		}
	};

	const dispose = (): void => {
		if (isDisposed) return;
		isDisposed = true;

		stop();

		canvas.removeEventListener('webglcontextlost', handleContextLost);
		canvas.removeEventListener('webglcontextrestored', handleContextRestored);

		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}

		if (!resizeObserver && typeof window !== 'undefined') {
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
		setPointer,
		start,
		stop,
		update,
		renderOnce,
		dispose,
	};
}
