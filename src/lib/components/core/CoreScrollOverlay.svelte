<script lang="ts">
import { onMount } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import { resolve } from '$app/paths';
import { fadeBlur, getTimeline, resolveEasingCss, resolveStage } from '$lib/animation';
import { registerRafTask } from '$lib/raf';

type Props = {
	pageType: 'index' | 'article';
};

type SpringState = {
	value: number;
	velocity: number;
};

const SPRING_LINE = { stiffness: 100, damping: 30 };
const SPRING_BASE = { stiffness: 60, damping: 30 };
const SPRING_MAGNET = { stiffness: 80, damping: 18 };

const LINE_HEIGHT = 600;
const BASE_RANGE = 50;
const BASE_TANH_SCALE = 0.003;
const MAGNET_RADIUS = 150;
const MAGNET_X_RANGE = 50;
const MAGNET_Y_RANGE = 20;

const clamp = (min: number, value: number, max: number) => Math.max(min, Math.min(value, max));

const spring = (current: SpringState, target: number, stiffness: number, damping: number, delta: number) => {
	const force = (target - current.value) * stiffness;
	const accel = force - current.velocity * damping;
	current.velocity += accel * delta;
	current.value += current.velocity * delta;
};

let { pageType }: Props = $props();

const isIndexPage = $derived(pageType === 'index');
const ctaLabel = $derived(isIndexPage ? 'BOOK A CALL ↗' : '← GO BACK');

const timeline = getTimeline();
const scrollStage = $derived(resolveStage(timeline, 'scroll'));
const lineDelay = $derived(scrollStage.delay);
const ctaDelay = $derived(scrollStage.delay + 140);
const lineDuration = $derived(scrollStage.duration);
const ctaDuration = $derived(scrollStage.duration);
const scrollEasingCss = $derived(resolveEasingCss(scrollStage.easing));

let overlayRef = $state<HTMLDivElement | null>(null);
let isMdUp = $state(false);
let lineOffset = $state(0);
let ctaOffset = $state(0);
let overlayRect: DOMRect | null = null;
let lineIntroStarted = $state(false);
let ctaIntroStarted = $state(false);
const lineHiddenStyle = $derived(lineIntroStarted ? '' : `opacity: 0; filter: blur(${scrollStage.blur}px);`);
const ctaHiddenStyle = $derived(ctaIntroStarted ? '' : `opacity: 0; filter: blur(${scrollStage.blur}px);`);
const lineGateVars = $derived(`--animate-delay: ${lineDelay}ms; --animate-duration: ${lineDuration}ms; --animate-y: 0px; --animate-blur: ${scrollStage.blur}px; --animate-ease: ${scrollEasingCss};`);
const ctaGateVars = $derived(`--animate-delay: ${ctaDelay}ms; --animate-duration: ${ctaDuration}ms; --animate-y: 0px; --animate-blur: ${scrollStage.blur}px; --animate-ease: ${scrollEasingCss};`);

const lineStyle = $derived(`transform: translate3d(0, ${lineOffset}px, 0);`);
const ctaStyle = $derived(`transform: translate3d(${ctaOffset}px, 0, 0);`);
const anchorLeft = $derived(isMdUp ? '20%' : '100%');

const attachOverlay = (node: HTMLDivElement) => {
	overlayRef = node;
	overlayRect = node.getBoundingClientRect();
	return {
		destroy() {
			overlayRef = null;
			overlayRect = null;
		},
	};
};

onMount(() => {
	if (prefersReducedMotion.current) {
		lineIntroStarted = true;
		ctaIntroStarted = true;
	}
	const root = document.documentElement;
	if (!root.hasAttribute('data-animate-ready')) {
		lineIntroStarted = true;
		ctaIntroStarted = true;
	}
	const updateIsMdUp = () => {
		isMdUp = window.matchMedia('(min-width: 768px)').matches;
	};

	let maxScroll = 1000;
	let windowWidth = window.innerWidth;
	let pointerX = windowWidth * 0.2;
	let pointerY = window.innerHeight / 2;
	let mouseX = pointerX;
	let rafHandle: ReturnType<typeof registerRafTask> | null = null;

	const line = { value: 0, velocity: 0 };
	const base = { value: 0, velocity: 0 };
	const magnetX = { value: 0, velocity: 0 };
	const magnetY = { value: 0, velocity: 0 };

	const updateOverlayRect = () => {
		overlayRect = overlayRef?.getBoundingClientRect() ?? null;
	};

	const updateMeasurements = () => {
		const footer = document.querySelector('[data-section="footer"]') as HTMLElement | null;
		const footerHeight = footer?.getBoundingClientRect().height ?? 0;
		const docHeight = document.documentElement.scrollHeight;
		const winHeight = window.innerHeight;
		maxScroll = Math.max(docHeight - winHeight - footerHeight, 1);

		windowWidth = window.innerWidth;
		updateIsMdUp();
		updateOverlayRect();

		const fallbackX = isMdUp ? windowWidth * 0.2 : windowWidth;
		const fallbackY = window.innerHeight / 2;
		pointerX = fallbackX;
		pointerY = fallbackY;
		mouseX = fallbackX;
	};

	const handleMouseMove = (event: MouseEvent) => {
		pointerX = event.clientX;
		pointerY = event.clientY;
		if (isMdUp) {
			mouseX = event.clientX;
		}
	};

	updateMeasurements();

	window.addEventListener('resize', updateMeasurements);
	window.addEventListener('mousemove', handleMouseMove);

	const observer = new ResizeObserver(updateMeasurements);
	observer.observe(document.body);

	const tick = (_time: number, deltaSeconds: number) => {
		if (deltaSeconds === 0) return;

		const delta = Math.min(deltaSeconds, 0.05);

		// Scroll → line mapping, excluding footer.
		const progress = clamp(0, window.scrollY / maxScroll, 1);
		const lineTarget = progress * LINE_HEIGHT;
		spring(line, lineTarget, SPRING_LINE.stiffness, SPRING_LINE.damping, delta);

		const anchorX = overlayRect ? (isMdUp ? overlayRect.width * 0.2 : overlayRect.width) : isMdUp ? windowWidth * 0.2 : windowWidth;
		const anchorY = overlayRect ? overlayRect.top + line.value + magnetY.value : line.value;

		// Base follow (soft clamp) + magnetic offset.
		const baseAnchor = windowWidth * 0.2;
		const baseDiff = mouseX - baseAnchor;
		const baseTarget = isMdUp ? Math.tanh(baseDiff * BASE_TANH_SCALE) * BASE_RANGE : 0;
		spring(base, baseTarget, SPRING_BASE.stiffness, SPRING_BASE.damping, delta);

		const dx = pointerX - anchorX;
		const dy = pointerY - anchorY;
		const distance = Math.hypot(dx, dy);
		const strength = Math.max(0, 1 - distance / MAGNET_RADIUS);
		const magnetTargetX = Math.tanh((dx / Math.max(distance, 1)) * 2) * MAGNET_X_RANGE * strength;
		const magnetTargetY = Math.tanh((dy / Math.max(distance, 1)) * 2) * MAGNET_Y_RANGE * strength;
		spring(magnetX, magnetTargetX, SPRING_MAGNET.stiffness, SPRING_MAGNET.damping, delta);
		spring(magnetY, magnetTargetY, SPRING_MAGNET.stiffness, SPRING_MAGNET.damping, delta);

		lineOffset = line.value + magnetY.value;
		ctaOffset = (isMdUp ? base.value : 0) + magnetX.value;
	};

	rafHandle = registerRafTask(tick);

	return () => {
		window.removeEventListener('resize', updateMeasurements);
		window.removeEventListener('mousemove', handleMouseMove);
		observer.disconnect();
		rafHandle?.dispose();
		rafHandle = null;
	};
});
</script>

<div
	use:attachOverlay
	class="-translate-y-[250px] padding-standard pointer-events-none fixed top-1/2 left-0 z-20 h-[400px] w-full select-none"
>
	<div
		class="relative h-px w-full"
		style={`${lineStyle}; will-change: transform; backface-visibility: hidden;`}
	>
        <div
            class="absolute inset-0 origin-left bg-black transform-gpu"
            style={`will-change: opacity, filter; backface-visibility: hidden; ${lineHiddenStyle} ${lineGateVars}`}
            data-animate
            in:fadeBlur={{
                delay: lineDelay,
                duration: lineDuration,
                y: 0,
				blur: scrollStage.blur,
				easing: scrollStage.easing,
			}}
			onintrostart={() => {
				lineIntroStarted = true;
			}}
		></div>
        <div
            class="pointer-events-auto absolute top-[1px] transform-gpu"
            style={`left: ${anchorLeft}; ${ctaStyle}; will-change: transform, opacity, filter; backface-visibility: hidden; ${ctaHiddenStyle} ${ctaGateVars}`}
            data-animate
            in:fadeBlur={{
                delay: ctaDelay,
                duration: ctaDuration,
                y: 0,
				blur: scrollStage.blur,
				easing: scrollStage.easing,
			}}
			onintrostart={() => {
				ctaIntroStarted = true;
			}}
		>
			{#if isIndexPage}
				<a
					class="-m-2.5 inline-block p-2.5"
					href="https://u29dc.co/hey"
					target="_blank"
					rel="noopener noreferrer"
				>
					<div
						class="-translate-x-full whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white md:-translate-x-1/2"
					>
						{ctaLabel}
					</div>
				</a>
			{:else}
				<a class="-m-2.5 inline-block p-2.5" href={resolve("/")}>
					<div
						class="-translate-x-full whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white md:-translate-x-1/2"
					>
						{ctaLabel}
					</div>
				</a>
			{/if}
		</div>
	</div>
</div>
