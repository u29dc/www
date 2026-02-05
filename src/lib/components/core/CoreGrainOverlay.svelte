<script lang="ts">
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	import { logEvent } from "$lib/logger";
	import { observeVisibility } from "$lib/observe";
	import { registerRafTask } from "$lib/raf";

	export interface CoreGrainOverlayProps {
		/** Grain intensity (0-1 range, default 0.25) */
		intensity?: number;
		/** Grain particle size in CSS pixels (default 1.6 = fine film grain) */
		grainScale?: number;
		/** Animation speed multiplier (default 0.45) */
		animationSpeed?: number;
		/** Per-channel chromatic jitter (0-1 range, default 0.12) */
		chromaticVariance?: number;
		/** Global intensity modifier (0-1 range, default 0.9) */
		exposure?: number;
		/** Additional Tailwind classes */
		className?: string;
	}

	type ThemeVariant = "light" | "dark";
	type DeviceTier = "high" | "medium" | "low";

	interface GrainState {
		intensity: number;
		grainScale: number;
		animationSpeed: number;
		chromaticVariance: number;
		exposure: number;
		themeVariant: ThemeVariant;
		isMotionDisabled: boolean;
		timeOffset: number;
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

	interface GrainRenderer {
		resize(): void;
		setState(state: GrainState): void;
		start(): void;
		stop(): void;
		renderOnce(): void;
		dispose(): void;
	}

	const UNIFORM_NAMES = [
		"u_resolution",
		"u_time",
		"u_intensity",
		"u_exposure",
		"u_grainRepeat",
		"u_chromaticVariance",
		"u_scrambleOffset",
		"u_blueNoise",
		"u_lowFreqSeed",
	] as const;

	const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

	const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_exposure;
uniform vec2 u_grainRepeat;
uniform float u_chromaticVariance;
uniform vec2 u_scrambleOffset;
uniform sampler2D u_blueNoise;
uniform float u_lowFreqSeed;

out vec4 fragColor;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float sampleBlueNoise(vec2 uv) {
	return texture(u_blueNoise, uv).r * 2.0 - 1.0;
}

void main() {
	vec2 pixelUV = gl_FragCoord.xy / u_resolution;
	vec2 repeat = u_grainRepeat;
	vec2 grainUV = pixelUV * repeat + u_scrambleOffset;

	float timeHashA = hash(vec2(u_time * 0.0003, u_lowFreqSeed * 1.37));
	float timeHashB = hash(vec2(u_time * 0.0005, u_lowFreqSeed * 3.11));
	vec2 temporalJitter = vec2(timeHashA, timeHashB) * 2.0 - 1.0;

	float grainA = sampleBlueNoise(grainUV);
	float grainB = sampleBlueNoise(grainUV * 1.231 + temporalJitter);
	float grainC = sampleBlueNoise(grainUV * 1.613 - temporalJitter.yx);
	float grainD = sampleBlueNoise(grainUV * 2.233 + temporalJitter.xx * 3.7);
	float grain = (grainA + grainB + grainC + grainD) * 0.25;

	float microDetail = sampleBlueNoise(grainUV * 3.97 + vec2(temporalJitter.y, temporalJitter.x) * 4.3);
	grain = mix(grain, grain + microDetail * 0.18, 0.5);
	grain = clamp(grain, -1.0, 1.0);

	vec3 chromaticGrain = vec3(grain);
	vec3 chromaJitter = vec3(
		sampleBlueNoise(grainUV + vec2(13.37, 7.11)),
		sampleBlueNoise(grainUV * 1.389 - vec2(11.71, 3.57)),
		sampleBlueNoise(grainUV * 0.923 + vec2(-5.97, 9.61))
	);
	chromaticGrain += (chromaJitter * 0.5) * u_chromaticVariance;
	chromaticGrain = clamp(chromaticGrain, -1.0, 1.0);

	float intensity = clamp(u_intensity, 0.0, 1.0);
	chromaticGrain *= intensity;

	vec3 finalColor = chromaticGrain * 0.5 + 0.5;

	float amplitude = dot(abs(chromaticGrain), vec3(1.0 / 3.0));
	float alpha = clamp(amplitude * mix(0.85, 1.35, clamp(u_exposure, 0.0, 1.0)), 0.0, 0.9);

	fragColor = vec4(finalColor, alpha);
}
`;

	const BLUE_NOISE_SIZE = 64;
	const BLUE_NOISE_PATH = "/textures/blue-noise-64.rgba";
	const BLUE_NOISE_URL = `${base}${BLUE_NOISE_PATH}`;
	let blueNoisePixelsPromise: Promise<Uint8Array> | null = null;

	const loadBlueNoisePixels = async (): Promise<Uint8Array> => {
		if (blueNoisePixelsPromise) {
			return blueNoisePixelsPromise;
		}
		blueNoisePixelsPromise = (async () => {
			const response = await fetch(BLUE_NOISE_URL, {
				cache: "force-cache",
			});
			if (!response.ok) {
				throw new Error(
					`Failed to fetch blue-noise texture (${response.status}).`,
				);
			}
			const buffer = await response.arrayBuffer();
			const bytes = new Uint8Array(buffer);
			const expectedSize = BLUE_NOISE_SIZE * BLUE_NOISE_SIZE * 4;
			if (bytes.length !== expectedSize) {
				throw new Error(
					`Unexpected blue-noise payload size: ${bytes.length}.`,
				);
			}
			return bytes;
		})();
		return blueNoisePixelsPromise;
	};

	const scheduleIdleTask = (callback: () => void) => {
		if (typeof window === "undefined") {
			return () => {};
		}

		const idleWindow = window as Window & {
			requestIdleCallback?: (
				handler: () => void,
				options?: { timeout?: number },
			) => number;
			cancelIdleCallback?: (handle: number) => void;
		};

		if (idleWindow.requestIdleCallback) {
			const handle = idleWindow.requestIdleCallback(() => callback(), {
				timeout: 1200,
			});
			return () => idleWindow.cancelIdleCallback?.(handle);
		}

		const timeout = window.setTimeout(callback, 160);
		return () => window.clearTimeout(timeout);
	};

	const DEFAULT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
		alpha: true,
		antialias: false,
		desynchronized: true,
		powerPreference: "high-performance",
		premultipliedAlpha: false,
		preserveDrawingBuffer: false,
		depth: false,
		stencil: false,
	};

	const GOLDEN_ANGLE = 2.39996322972865;
	const SCRAMBLE_OFFSETS = Array.from({ length: 16 }, (_, i) => {
		const angle = i * GOLDEN_ANGLE;
		return [Math.cos(angle), Math.sin(angle)] as [number, number];
	});

	function detectDeviceTier(): DeviceTier {
		if (typeof window === "undefined" || typeof navigator === "undefined") {
			return "high";
		}

		const memory =
			(navigator as { deviceMemory?: number }).deviceMemory ?? 4;
		const cores = navigator.hardwareConcurrency ?? 4;
		const prefersReducedMotion =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
			false;

		if (prefersReducedMotion || memory <= 2 || cores <= 2) {
			return "low";
		}
		if (memory <= 4 || cores <= 4) {
			return "medium";
		}
		return "high";
	}

	function getDprCap(): number {
		const tier = detectDeviceTier();
		const isMobile =
			typeof window !== "undefined" &&
			(window.matchMedia?.("(max-width: 768px)").matches ??
				window.innerWidth <= 768);
		if (tier === "low") return 1;
		if (tier === "medium") return isMobile ? 1.25 : 1.5;
		return isMobile ? 1.5 : 2;
	}

	function readSystemTheme(): ThemeVariant {
		if (typeof document !== "undefined") {
			const root = document.documentElement;
			if (root.classList.contains("dark")) return "dark";
			if (root.classList.contains("light")) return "light";
		}
		if (typeof window !== "undefined") {
			return window.matchMedia?.("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		}
		return "light";
	}

	function createGraphicsContext(
		canvas: HTMLCanvasElement,
	): WebGL2RenderingContext {
		const gl = canvas.getContext("webgl2", DEFAULT_CONTEXT_ATTRIBUTES);

		if (!gl) {
			const errorInstance = new Error("WebGL2 context unavailable");
			logEvent("grain-overlay", "context", "FAIL", {
				errorMessage: errorInstance.message,
				errorStack: errorInstance.stack,
			});
			throw new Error("WebGL2 is not supported on this device.");
		}

		return gl;
	}

	function measureCanvas(
		canvas: HTMLCanvasElement,
		dprCap: number,
	): CanvasDimensions {
		const rect = canvas.getBoundingClientRect();
		const deviceDpr = window.devicePixelRatio || 1;
		const dpr = Math.min(deviceDpr, dprCap);

		let width = rect.width;
		let height = rect.height;

		const computed = window.getComputedStyle(canvas);
		const isFixedViewportOverlay =
			computed.position === "fixed" &&
			computed.left === "0px" &&
			computed.top === "0px" &&
			computed.right === "0px" &&
			computed.bottom === "0px";

		if (isFixedViewportOverlay) {
			width = window.innerWidth;
			height = window.innerHeight;
		} else if (!width || !height) {
			width = width || window.innerWidth;
			height = height || window.innerHeight;
		}

		if (!width) {
			width = canvas.width || canvas.clientWidth;
		}
		if (!height) {
			height = canvas.height || canvas.clientHeight;
		}

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

	function applyCanvasSize(
		canvas: HTMLCanvasElement,
		gl: WebGL2RenderingContext,
		dimensions: CanvasDimensions,
	): void {
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

	function createStaticBuffer(
		gl: WebGL2RenderingContext,
		data: Float32Array,
		itemSize: number,
	): BufferDescriptor {
		const buffer = gl.createBuffer();
		if (!buffer) {
			throw new Error("Failed to create buffer.");
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

		return {
			buffer,
			itemSize,
			itemCount: data.length / itemSize,
		};
	}

	function createFullscreenQuad(
		gl: WebGL2RenderingContext,
	): BufferDescriptor {
		const positions = new Float32Array([
			-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
		]);

		return createStaticBuffer(gl, positions, 2);
	}

	function disposeBuffer(
		gl: WebGL2RenderingContext,
		descriptor: BufferDescriptor | null,
	): void {
		if (!descriptor) return;
		gl.deleteBuffer(descriptor.buffer);
	}

	interface ShaderSources {
		vertex: string;
		fragment: string;
	}

	function compileShader(
		gl: WebGL2RenderingContext,
		type: number,
		source: string,
	): WebGLShader {
		const shader = gl.createShader(type);
		if (!shader) {
			throw new Error("Failed to allocate shader.");
		}

		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
		if (!success) {
			const log =
				gl.getShaderInfoLog(shader) ??
				"Unknown shader compilation error.";
			gl.deleteShader(shader);
			throw new Error(log);
		}

		return shader;
	}

	function createProgram(
		gl: WebGL2RenderingContext,
		sources: ShaderSources,
	): WebGLProgram {
		const vertexShader = compileShader(
			gl,
			gl.VERTEX_SHADER,
			sources.vertex,
		);
		const fragmentShader = compileShader(
			gl,
			gl.FRAGMENT_SHADER,
			sources.fragment,
		);

		const program = gl.createProgram();
		if (!program) {
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);
			throw new Error("Failed to allocate shader program.");
		}

		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		const success = gl.getProgramParameter(program, gl.LINK_STATUS);
		if (!success) {
			const log =
				gl.getProgramInfoLog(program) ??
				"Unknown shader linking error.";
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

	function resolveUniforms<const TKeys extends readonly string[]>(
		gl: WebGL2RenderingContext,
		program: WebGLProgram,
		names: TKeys,
	): UniformMap<TKeys> {
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
			logEvent("grain-overlay", "uniform", "WARN", {
				missingUniforms,
				totalRequested: names.length,
			});
		}

		return uniforms;
	}

	function setUniform1f(
		location: WebGLUniformLocation | null,
		value: number,
		gl: WebGL2RenderingContext,
	): void {
		if (!location) return;
		gl.uniform1f(location, value);
	}

	function setUniform2f(
		location: WebGLUniformLocation | null,
		x: number,
		y: number,
		gl: WebGL2RenderingContext,
	): void {
		if (!location) return;
		gl.uniform2f(location, x, y);
	}

	function createGrainRenderer(
		canvas: HTMLCanvasElement,
		initialState: GrainState,
		blueNoisePixels: Uint8Array,
	): GrainRenderer {
		const gl = createGraphicsContext(canvas);
		const program = createProgram(gl, {
			vertex: VERTEX_SHADER,
			fragment: FRAGMENT_SHADER,
		});

		gl.useProgram(program);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(
			gl.SRC_ALPHA,
			gl.ONE_MINUS_SRC_ALPHA,
			gl.ONE,
			gl.ONE_MINUS_SRC_ALPHA,
		);
		gl.disable(gl.DEPTH_TEST);

		const fullscreenQuad = createFullscreenQuad(gl);
		const positionLocation = gl.getAttribLocation(program, "a_position");
		if (positionLocation === -1) {
			logEvent("grain-overlay", "attrib-missing", "WARN", {
				attribute: "a_position",
			});
		}

		const vao = gl.createVertexArray();
		if (!vao) {
			throw new Error("Failed to create vertex array.");
		}

		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
		gl.vertexAttribPointer(
			positionLocation,
			fullscreenQuad.itemSize,
			gl.FLOAT,
			false,
			0,
			0,
		);
		gl.enableVertexAttribArray(positionLocation);
		gl.bindVertexArray(null);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		const uniforms = resolveUniforms(gl, program, UNIFORM_NAMES);
		const blueNoiseTexture = gl.createTexture();
		if (!blueNoiseTexture) {
			throw new Error("Failed to create blue-noise texture.");
		}

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			BLUE_NOISE_SIZE,
			BLUE_NOISE_SIZE,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			blueNoisePixels,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.uniform1i(uniforms.u_blueNoise, 0);
		gl.bindTexture(gl.TEXTURE_2D, null);

		let state = { ...initialState };
		const dprCap = getDprCap();
		let dimensions = measureCanvas(canvas, dprCap);
		applyCanvasSize(canvas, gl, dimensions);

		let frameCounter = 0;
		let isRunning = false;
		let isDisposed = false;
		let resizeObserver: ResizeObserver | null = null;

		const updateResolutionUniforms = () => {
			setUniform2f(
				uniforms.u_resolution,
				dimensions.pixelWidth,
				dimensions.pixelHeight,
				gl,
			);
		};

		const computeRepeats = (
			width: number,
			height: number,
			grainPixels: number,
		) => {
			const size = Math.max(grainPixels, 0.1);
			return {
				x: Math.max(width / size, 1.0),
				y: Math.max(height / size, 1.0),
			};
		};

		const computeScrambleOffset = (
			index: number,
			isFrozen: boolean,
			repeats: { x: number; y: number },
		) => {
			if (isFrozen) {
				return [0, 0] as const;
			}
			const base = SCRAMBLE_OFFSETS[index] ?? [0, 0];
			const minRepeat = Math.max(Math.min(repeats.x, repeats.y), 1.0);
			const magnitude = 0.5 / minRepeat;
			return [base[0] * magnitude, base[1] * magnitude] as const;
		};

		const drawFrame = (timestamp: number) => {
			if (isDisposed) return;

			const time = state.isMotionDisabled
				? state.timeOffset
				: timestamp * state.animationSpeed + state.timeOffset;
			const repeats = computeRepeats(
				dimensions.width,
				dimensions.height,
				state.grainScale,
			);
			const scrambleIndex = frameCounter % SCRAMBLE_OFFSETS.length;
			const [scrambleX, scrambleY] = computeScrambleOffset(
				scrambleIndex,
				state.isMotionDisabled,
				repeats,
			);
			frameCounter += 1;

			gl.useProgram(program);
			gl.bindVertexArray(vao);

			updateResolutionUniforms();
			setUniform1f(uniforms.u_time, time, gl);
			setUniform1f(uniforms.u_intensity, state.intensity, gl);
			setUniform1f(uniforms.u_exposure, state.exposure, gl);
			setUniform2f(uniforms.u_grainRepeat, repeats.x, repeats.y, gl);
			setUniform1f(
				uniforms.u_chromaticVariance,
				state.chromaticVariance,
				gl,
			);
			setUniform2f(uniforms.u_scrambleOffset, scrambleX, scrambleY, gl);
			setUniform1f(uniforms.u_lowFreqSeed, state.timeOffset, gl);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.itemCount);
			gl.bindVertexArray(null);
		};

		const tick = (timestamp: number, _deltaSeconds: number) => {
			if (!isRunning) return;
			drawFrame(timestamp);
		};

		const rafTask = registerRafTask(tick);

		const start = () => {
			if (isRunning || isDisposed) return;
			isRunning = true;
		};

		const stop = () => {
			if (!isRunning) return;
			isRunning = false;
		};

		const renderOnce = () => {
			drawFrame(performance.now());
		};

		const resize = () => {
			dimensions = measureCanvas(canvas, dprCap);
			applyCanvasSize(canvas, gl, dimensions);
			updateResolutionUniforms();
		};

		const handleWindowResize = () => {
			resize();
		};

		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(() => {
				resize();
			});
			resizeObserver.observe(canvas);
		}

		if (typeof window !== "undefined") {
			window.addEventListener("resize", handleWindowResize);
		}

		const setState = (nextState: GrainState) => {
			const previousState = state;
			state = { ...nextState };
			if (state.isMotionDisabled && !previousState.isMotionDisabled) {
				frameCounter = 0;
			}
		};

		const dispose = () => {
			if (isDisposed) return;
			isDisposed = true;

			stop();
			rafTask.dispose();

			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}

			if (typeof window !== "undefined") {
				window.removeEventListener("resize", handleWindowResize);
			}

			gl.bindTexture(gl.TEXTURE_2D, null);
			gl.deleteTexture(blueNoiseTexture);
			gl.bindVertexArray(null);
			gl.deleteVertexArray(vao);
			disposeBuffer(gl, fullscreenQuad);
			gl.deleteProgram(program);
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
		intensity = 0.25,
		grainScale = 1.6,
		animationSpeed = 0.45,
		chromaticVariance = 0.12,
		exposure = 0.9,
		className = "",
	}: CoreGrainOverlayProps = $props();

	const classValue = $derived(className);
	const canvasStyle =
		"width: 100%; height: 100%; display: block; --animate-duration: 700ms; --animate-delay: 0ms; --animate-y: 0px; --animate-blur: 0px;";
	const timeOffset = Math.random() * 1000;

	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let renderer = $state<GrainRenderer | null>(null);
	let resolvedTheme = $state<ThemeVariant>("light");
	let prefersReducedMotion = $state(false);
	let isPageVisible = $state(true);
	let deviceTier = $state<DeviceTier>("high");
	let isInView = $state(true);
	let webglFailed = $state(false);
	let hasRenderedStatic = false;

	const adjustedIntensity = $derived(
		resolvedTheme === "light" ? intensity * 1.1 : intensity * 0.8,
	);
	const isActive = $derived(
		deviceTier !== "low" &&
			isPageVisible &&
			!prefersReducedMotion &&
			isInView,
	);

	const grainState = $derived<GrainState>({
		intensity: adjustedIntensity,
		grainScale,
		animationSpeed,
		chromaticVariance,
		exposure,
		themeVariant: resolvedTheme,
		isMotionDisabled: prefersReducedMotion,
		timeOffset,
	});

	onMount(() => {
		deviceTier = detectDeviceTier();

		const motionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		const updateMotionPreference = () => {
			prefersReducedMotion = motionQuery.matches;
		};
		updateMotionPreference();
		motionQuery.addEventListener("change", updateMotionPreference);

		const updatePageVisibility = () => {
			isPageVisible = document.visibilityState === "visible";
		};
		updatePageVisibility();
		document.addEventListener("visibilitychange", updatePageVisibility);

		const syncTheme = () => {
			resolvedTheme = readSystemTheme();
		};
		syncTheme();

		const root = document.documentElement;
		const themeObserver = new MutationObserver(() => {
			syncTheme();
		});
		themeObserver.observe(root, {
			attributes: true,
			attributeFilter: ["class"],
		});

		const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleThemeChange = () => {
			syncTheme();
		};
		themeQuery.addEventListener("change", handleThemeChange);

		const cleanup = () => {
			motionQuery.removeEventListener("change", updateMotionPreference);
			document.removeEventListener(
				"visibilitychange",
				updatePageVisibility,
			);
			themeObserver.disconnect();
			themeQuery.removeEventListener("change", handleThemeChange);
		};

		if (!canvasRef) {
			return cleanup;
		}

		let isDisposed = false;
		let cancelIdleTask = () => {};

		const initRenderer = async () => {
			try {
				const blueNoisePixels = await loadBlueNoisePixels();
				if (!canvasRef || isDisposed) return;
				renderer = createGrainRenderer(
					canvasRef,
					grainState,
					blueNoisePixels,
				);
				logEvent("grain-overlay", "mount", "SUCCESS", {
					intensity: adjustedIntensity,
					theme: resolvedTheme,
				});
			} catch (error) {
				webglFailed = true;
				logEvent("grain-overlay", "mount", "FAIL", {
					message:
						error instanceof Error ? error.message : String(error),
				});
				cleanup();
			}
		};

		cancelIdleTask = scheduleIdleTask(() => {
			void initRenderer();
		});

		return () => {
			isDisposed = true;
			cancelIdleTask();
			renderer?.dispose();
			renderer = null;
			cleanup();
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
		renderer.setState(grainState);
		renderer.resize();
		if (!isActive) {
			renderer.renderOnce();
			hasRenderedStatic = true;
		}
	});
</script>

{#if !webglFailed}
	<canvas
		bind:this={canvasRef}
		class={`pointer-events-none fixed inset-0 z-50 ${classValue}`}
		style={canvasStyle}
		data-animate
		aria-hidden="true"
		use:observeVisibility={{
			onEnter: () => { isInView = true; },
			onLeave: () => { isInView = false; },
			once: false,
			rootMargin: '0px',
			threshold: 0,
		}}
	></canvas>
{/if}
