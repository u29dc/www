'use client';

/**
 * Atomic Brand Logo
 *
 * ## SUMMARY
 * Interactive WebGL logo with 4:1 aspect ratio and mouse-based blur effects.
 *
 * ## RESPONSIBILITIES
 * - Compile WebGL shaders, handle high-DPR canvases, clean up GPU resources
 *
 * @module components/atomic/atomic-brand-logo
 */

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';

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
}

export interface WebGLSetup {
	program: WebGLProgram;
	positionBuffer: WebGLBuffer;
	uniformLocations: {
		mouse: WebGLUniformLocation | null;
		resolution: WebGLUniformLocation | null;
		pixelRatio: WebGLUniformLocation | null;
		rectWidth: WebGLUniformLocation | null;
		rectHeight: WebGLUniformLocation | null;
		roundness: WebGLUniformLocation | null;
		blurStart: WebGLUniformLocation | null;
		defaultBlurIntensity: WebGLUniformLocation | null;
		mouseBlurSize: WebGLUniformLocation | null;
		mouseBlurIntensity: WebGLUniformLocation | null;
		widthSpreadMultiplier: WebGLUniformLocation | null;
		heightSpreadMultiplier: WebGLUniformLocation | null;
		color: WebGLUniformLocation | null;
		noiseIntensity: WebGLUniformLocation | null;
		noiseScale: WebGLUniformLocation | null;
		time: WebGLUniformLocation | null;
	};
}

const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_position;

void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

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

	gl_FragColor = vec4(noisyColor, alpha);
}
`;

const TRIANGLE_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

const damp = (current: number, target: number, lambda: number, dt: number) => {
	const t = Math.exp(-lambda * dt);
	return current * t + target * (1 - t);
};

const hexToRgb = (hex: string) => {
	const value = hex.startsWith('#') ? hex.slice(1) : hex;
	const bigint = parseInt(value.length === 3 ? value.replace(/(.)/g, '$1$1') : value, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return [r / 255, g / 255, b / 255] as const;
};

const initializeWebGLProgram = (gl: WebGLRenderingContext): WebGLSetup | null => {
	try {
		const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
		// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is WebGL API, not React hook
		gl.useProgram(program);

		const positionBuffer = gl.createBuffer();
		if (!positionBuffer) {
			throw new Error('Failed to create position buffer');
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE_VERTICES, gl.STATIC_DRAW);

		const positionLocation = gl.getAttribLocation(program, 'a_position');
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);

		const uniformLocations = {
			mouse: gl.getUniformLocation(program, 'u_mouse'),
			resolution: gl.getUniformLocation(program, 'u_resolution'),
			pixelRatio: gl.getUniformLocation(program, 'u_pixelRatio'),
			rectWidth: gl.getUniformLocation(program, 'u_rectWidth'),
			rectHeight: gl.getUniformLocation(program, 'u_rectHeight'),
			roundness: gl.getUniformLocation(program, 'u_roundness'),
			blurStart: gl.getUniformLocation(program, 'u_blurStart'),
			defaultBlurIntensity: gl.getUniformLocation(program, 'u_defaultBlurIntensity'),
			mouseBlurSize: gl.getUniformLocation(program, 'u_mouseBlurSize'),
			mouseBlurIntensity: gl.getUniformLocation(program, 'u_mouseBlurIntensity'),
			widthSpreadMultiplier: gl.getUniformLocation(program, 'u_widthSpreadMultiplier'),
			heightSpreadMultiplier: gl.getUniformLocation(program, 'u_heightSpreadMultiplier'),
			color: gl.getUniformLocation(program, 'u_color'),
			noiseIntensity: gl.getUniformLocation(program, 'u_noiseIntensity'),
			noiseScale: gl.getUniformLocation(program, 'u_noiseScale'),
			time: gl.getUniformLocation(program, 'u_time'),
		};

		return { program, positionBuffer, uniformLocations };
	} catch (_error) {
		return null;
	}
};

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('Failed to create shader');
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader error';
		gl.deleteShader(shader);
		throw new Error(info);
	}
	return shader;
};

const createProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) => {
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		throw new Error('Failed to create program');
	}
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program) ?? 'Unknown program error';
		gl.deleteProgram(program);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		throw new Error(info);
	}
	gl.detachShader(program, vertexShader);
	gl.detachShader(program, fragmentShader);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);
	return program;
};

export function AtomicBrandLogo({
	width = 200,
	blurStart = 1.0,
	defaultBlurIntensity = 0.5,
	mouseBlurIntensity = 0.75,
	mouseBlurSize = 0.5,
	roundness = 0.5,
	noiseIntensity = 0.15,
	noiseScale = 150.0,
	animateNoise = false,
	className = '',
}: AtomicBrandLogoProps) {
	const { resolvedTheme } = useTheme();
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const context =
			canvas.getContext('webgl', {
				alpha: true,
				antialias: true,
				preserveDrawingBuffer: false,
			}) ?? canvas.getContext('experimental-webgl');

		if (!(context instanceof WebGLRenderingContext)) {
			return;
		}

		const gl = context;

		if (!gl.getExtension('OES_standard_derivatives')) {
			// log
		}

		const setup = initializeWebGLProgram(gl);
		if (!setup) return;

		const { program, positionBuffer, uniformLocations } = setup;

		let animationFrame = 0;
		let lastTime = performance.now();
		let dpr = Math.min(window.devicePixelRatio || 1, 2);

		const containerWidth = width;
		const containerHeight = width / 4;

		const mouse = { x: containerWidth / 2, y: containerHeight / 2 };
		const mouseDamped = { x: mouse.x, y: mouse.y };

		const setUniform1f = (location: WebGLUniformLocation | null, value: number) => {
			if (location) gl.uniform1f(location, value);
		};

		const applyStaticUniforms = () => {
			setUniform1f(uniformLocations.rectWidth, 2.0);
			setUniform1f(uniformLocations.rectHeight, 0.5);
			setUniform1f(uniformLocations.roundness, roundness);
			setUniform1f(uniformLocations.blurStart, blurStart);
			setUniform1f(uniformLocations.defaultBlurIntensity, defaultBlurIntensity);
			setUniform1f(uniformLocations.mouseBlurSize, mouseBlurSize);
			setUniform1f(uniformLocations.mouseBlurIntensity, mouseBlurIntensity);
			setUniform1f(uniformLocations.noiseIntensity, noiseIntensity);
			setUniform1f(uniformLocations.noiseScale, noiseScale);
		};

		const resize = () => {
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			const displayWidth = Math.floor(containerWidth * dpr);
			const displayHeight = Math.floor(containerHeight * dpr);

			if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
				canvas.width = displayWidth;
				canvas.height = displayHeight;
			}

			canvas.style.width = `${containerWidth}px`;
			canvas.style.height = `${containerHeight}px`;

			gl.viewport(0, 0, displayWidth, displayHeight);

			if (uniformLocations.resolution) {
				gl.uniform2f(uniformLocations.resolution, displayWidth, displayHeight);
			}
			if (uniformLocations.pixelRatio) {
				gl.uniform1f(uniformLocations.pixelRatio, dpr);
			}
		};

		const handlePointerMove = (event: PointerEvent | MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mouse.x = event.clientX - rect.left;
			mouse.y = event.clientY - rect.top;
		};

		const applyThemeUniforms = () => {
			const widthMultiplier = resolvedTheme === 'dark' ? 0.75 : 0.75;
			const heightMultiplier = resolvedTheme === 'dark' ? 0.1 : 0.5;
			setUniform1f(uniformLocations.widthSpreadMultiplier, widthMultiplier);
			setUniform1f(uniformLocations.heightSpreadMultiplier, heightMultiplier);

			const colorHex = resolvedTheme === 'dark' ? '#ffffff' : '#000000';
			const [r, g, b] = hexToRgb(colorHex);
			if (uniformLocations.color) {
				gl.uniform3f(uniformLocations.color, r, g, b);
			}
		};

		const applyDynamicUniforms = (mousePos: { x: number; y: number }, currentTime: number) => {
			if (uniformLocations.mouse) {
				gl.uniform2f(uniformLocations.mouse, mousePos.x, mousePos.y);
			}

			if (animateNoise && uniformLocations.time) {
				gl.uniform1f(uniformLocations.time, currentTime * 0.0001);
			}
		};

		const render = () => {
			const now = performance.now();
			const dt = (now - lastTime) / 1000;
			lastTime = now;

			mouseDamped.x = damp(mouseDamped.x, mouse.x, 8, dt);
			mouseDamped.y = damp(mouseDamped.y, mouse.y, 8, dt);

			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			applyDynamicUniforms(mouseDamped, now);
			applyThemeUniforms();

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			animationFrame = requestAnimationFrame(render);
		};

		resize();
		applyStaticUniforms();

		window.addEventListener('resize', resize);
		document.addEventListener('mousemove', handlePointerMove);
		document.addEventListener('pointermove', handlePointerMove);

		render();

		return () => {
			cancelAnimationFrame(animationFrame);
			window.removeEventListener('resize', resize);
			document.removeEventListener('mousemove', handlePointerMove);
			document.removeEventListener('pointermove', handlePointerMove);
			gl.deleteProgram(program);
			gl.deleteBuffer(positionBuffer);
		};
	}, [
		width,
		blurStart,
		defaultBlurIntensity,
		mouseBlurIntensity,
		mouseBlurSize,
		roundness,
		noiseIntensity,
		noiseScale,
		animateNoise,
		resolvedTheme,
	]);

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
