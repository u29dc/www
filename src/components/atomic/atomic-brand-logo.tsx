'use client';

/**
 * Atomic Brand Logo
 *
 * ## SUMMARY
 * Interactive WebGL logo with 4:1 aspect ratio and mouse-based blur effects driven by reusable runtime.
 *
 * ## RESPONSIBILITIES
 * - Configure renderer state and provide logo-specific module logic
 * - Maintain parity with legacy visuals while relying on shared WebGL utilities
 *
 * @module components/atomic/atomic-brand-logo
 */

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef } from 'react';
import {
	type CanvasDimensions,
	createFullscreenQuad,
	createProgram,
	createRenderer,
	disposeBuffer,
	type RendererHandle,
	type RendererModule,
	resolveUniforms,
	setUniform1f,
	setUniform2f,
	setUniform3f,
} from '@/lib/webgl';

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
}

type ThemeVariant = 'light' | 'dark';

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

const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

#if __VERSION__ >= 300
	#define HAS_STANDARD_DERIVATIVES 1
#else
	#ifdef GL_OES_standard_derivatives
		#extension GL_OES_standard_derivatives : enable
		#define HAS_STANDARD_DERIVATIVES 1
	#else
		#define HAS_STANDARD_DERIVATIVES 0
	#endif
#endif
#ifndef HAS_STANDARD_DERIVATIVES
	#define HAS_STANDARD_DERIVATIVES 0
#endif

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
	#if HAS_STANDARD_DERIVATIVES
		float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
		return smoothstep(threshold - afwidth, threshold + afwidth, value);
	#else
		float epsilon = 0.01;
		return smoothstep(threshold - epsilon, threshold + epsilon, value);
	#endif
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

	gl_FragColor = vec4(noisyColor, alpha);
}
`;

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
	const bigint = parseInt(sanitized, 16);
	const r = ((bigint >> 16) & 255) / 255;
	const g = ((bigint >> 8) & 255) / 255;
	const b = (bigint & 255) / 255;
	return [r, g, b];
}

function resolveTheme(
	theme: AtomicBrandLogoProps['theme'],
	resolved: string | undefined,
): ThemeVariant {
	if (theme && theme !== 'system') {
		return theme;
	}
	return resolved === 'dark' ? 'dark' : 'light';
}

function buildRendererState(
	props: Omit<AtomicBrandLogoState, 'theme'>,
	theme: ThemeVariant,
): AtomicBrandLogoState {
	return {
		...props,
		theme,
	};
}

function createAtomicBrandLogoModule(): RendererModule<AtomicBrandLogoState> {
	return {
		id: 'atomic-brand-logo',
		onInit({ context, dimensions, state, registerDisposer, logger }) {
			const { gl, canvas } = context;
			const program = createProgram(context, {
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
				logger.error('[webgl|atomic-logo|attrib-missing]', undefined, {
					attribute: 'a_position',
				});
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
			gl.enableVertexAttribArray(positionLocation);
			gl.vertexAttribPointer(
				positionLocation,
				fullscreenQuad.itemSize,
				gl.FLOAT,
				false,
				0,
				0,
			);

			const uniforms = resolveUniforms(gl, program, UNIFORM_NAMES);
			const initialWidth = dimensions.width || state.width;
			const initialHeight = dimensions.height || state.height;
			const initialDpr =
				dimensions.dpr ||
				(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
			const applyCanvasSizing = (incoming: CanvasDimensions) => {
				canvas.width = incoming.pixelWidth;
				canvas.height = incoming.pixelHeight;
				canvas.style.width = `${incoming.width}px`;
				canvas.style.height = `${incoming.height}px`;
				gl.viewport(0, 0, incoming.pixelWidth, incoming.pixelHeight);
			};
			const mousePosition = {
				x: initialWidth / 2,
				y: state.height / 2,
			};
			const dampedMouse = { ...mousePosition };
			let hasPointerInteraction = false;
			const colorCache = new Map<string, [number, number, number]>();
			let hasLoggedFirstFrame = false;
			const checkGlError = (phase: string) => {
				const error = gl.getError();
				if (error !== gl.NO_ERROR) {
					logger.error('[webgl|atomic-logo|gl-error]', undefined, {
						phase,
						error,
					});
				}
			};

			const updateResolutionUniforms = (incoming: CanvasDimensions) => {
				applyCanvasSizing(incoming);
				setUniform2f(uniforms.u_resolution, incoming.pixelWidth, incoming.pixelHeight, gl);
				setUniform1f(uniforms.u_pixelRatio, incoming.dpr, gl);
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

			document.addEventListener('pointermove', handlePointerMove);
			document.addEventListener('mousemove', handlePointerMove);
			registerDisposer(() => {
				document.removeEventListener('pointermove', handlePointerMove);
				document.removeEventListener('mousemove', handlePointerMove);
			});

			registerDisposer(() => {
				gl.disableVertexAttribArray(positionLocation);
				disposeBuffer(gl, fullscreenQuad);
				gl.deleteProgram(program);
			});

			applyStaticUniforms(state);
			applyThemeUniforms(state.theme);
			const initialDimensions: CanvasDimensions =
				dimensions.width > 0 && dimensions.height > 0
					? dimensions
					: {
							...dimensions,
							width: initialWidth,
							height: initialHeight,
							dpr: initialDpr,
							pixelWidth: Math.floor(initialWidth * initialDpr),
							pixelHeight: Math.floor(initialHeight * initialDpr),
						};
			updateResolutionUniforms(initialDimensions);

			return {
				onFrame({ delta, now }, currentState) {
					const dt = delta / 1000;
					if (!hasLoggedFirstFrame) {
						hasLoggedFirstFrame = true;
						logger.info('[webgl|atomic-logo|frame-start]', {
							delta,
							now,
						});
					}
					dampedMouse.x = damp(dampedMouse.x, mousePosition.x, 8, dt);
					dampedMouse.y = damp(dampedMouse.y, mousePosition.y, 8, dt);

					gl.useProgram(program);
					gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
					gl.enableVertexAttribArray(positionLocation);
					gl.vertexAttribPointer(
						positionLocation,
						fullscreenQuad.itemSize,
						gl.FLOAT,
						false,
						0,
						0,
					);
					applyStaticUniforms(currentState);
					applyThemeUniforms(currentState.theme);
					gl.clearColor(0, 0, 0, 0);
					gl.clear(gl.COLOR_BUFFER_BIT);

					setUniform2f(uniforms.u_mouse, dampedMouse.x, dampedMouse.y, gl);

					if (currentState.animateNoise) {
						setUniform1f(uniforms.u_time, now * 0.0001, gl);
					}
					checkGlError('beforeDraw');

					gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.itemCount);
					checkGlError('afterDraw');
				},
				onResize(nextDimensions) {
					gl.useProgram(program);
					updateResolutionUniforms(nextDimensions);
					if (!hasPointerInteraction) {
						mousePosition.x = nextDimensions.width / 2;
						mousePosition.y = nextDimensions.height / 2;
						dampedMouse.x = mousePosition.x;
						dampedMouse.y = mousePosition.y;
						return;
					}
					mousePosition.x = Math.min(Math.max(mousePosition.x, 0), nextDimensions.width);
					mousePosition.y = Math.min(Math.max(mousePosition.y, 0), nextDimensions.height);
				},
				onStateChange(nextState, previousState) {
					gl.useProgram(program);
					applyStaticUniforms(nextState);
					if (nextState.theme !== previousState.theme) {
						applyThemeUniforms(nextState.theme);
					}
				},
				onDispose() {
					logger.info('[webgl|renderer|disposed]');
				},
			};
		},
	};
}

export function AtomicBrandLogo({
	width = 200,
	blurStart = 1.0,
	defaultBlurIntensity = 0.5,
	mouseBlurIntensity = 1.0,
	mouseBlurSize = 0.5,
	roundness = 0.5,
	noiseIntensity = 0.15,
	noiseScale = 150,
	animateNoise = false,
	className,
	theme,
}: AtomicBrandLogoProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rendererRef = useRef<RendererHandle<AtomicBrandLogoState> | null>(null);
	const { resolvedTheme } = useTheme();

	const effectiveTheme = resolveTheme(theme, resolvedTheme);

	const baseState = useMemo(
		() =>
			buildRendererState(
				{
					width,
					height: width / 4,
					blurStart,
					defaultBlurIntensity,
					mouseBlurIntensity,
					mouseBlurSize,
					roundness,
					noiseIntensity,
					noiseScale,
					animateNoise,
				},
				effectiveTheme,
			),
		[
			width,
			blurStart,
			defaultBlurIntensity,
			mouseBlurIntensity,
			mouseBlurSize,
			roundness,
			noiseIntensity,
			noiseScale,
			animateNoise,
			effectiveTheme,
		],
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		if (rendererRef.current) return;

		const renderer = createRenderer<AtomicBrandLogoState>({
			canvas,
			modules: [createAtomicBrandLogoModule()],
			initialState: baseState,
			label: 'atomic-brand-logo',
		});

		rendererRef.current = renderer;

		return () => {
			rendererRef.current?.dispose();
			rendererRef.current = null;
		};
	}, [baseState]);

	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.setState(baseState);
	}, [baseState]);

	useEffect(() => {
		const renderer = rendererRef.current;
		if (!renderer) return;
		renderer.resize({ width: baseState.width, height: baseState.height });
	}, [baseState.height, baseState.width]);

	const containerWidth = width;
	const containerHeight = width / 4;

	return (
		<div
			className={className}
			style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}
		>
			<canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
		</div>
	);
}
