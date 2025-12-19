<script lang="ts">
import { onMount } from 'svelte';
import { resolve } from '$app/paths';

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

const LINE_HEIGHT = 500;
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

let overlayRef = $state<HTMLDivElement | null>(null);
let isMdUp = $state(false);
let lineOffset = $state(0);
let ctaOffset = $state(0);

const lineStyle = $derived(`transform: translate3d(0, ${lineOffset}px, 0);`);
const ctaStyle = $derived(`transform: translate3d(${ctaOffset}px, 0, 0);`);
const anchorLeft = $derived(isMdUp ? '20%' : '100%');

const attachOverlay = (node: HTMLDivElement) => {
	overlayRef = node;
	return {
		destroy() {
			overlayRef = null;
		},
	};
};

onMount(() => {
	const updateIsMdUp = () => {
		isMdUp = window.matchMedia('(min-width: 768px)').matches;
	};

	let maxScroll = 1000;
	let windowWidth = window.innerWidth;
	let pointerX = windowWidth * 0.2;
	let pointerY = window.innerHeight / 2;
	let mouseX = pointerX;

	const line = { value: 0, velocity: 0 };
	const base = { value: 0, velocity: 0 };
	const magnetX = { value: 0, velocity: 0 };
	const magnetY = { value: 0, velocity: 0 };

	const updateMeasurements = () => {
		const footer = document.querySelector('[data-section="footer"]') as HTMLElement | null;
		const footerHeight = footer?.getBoundingClientRect().height ?? 0;
		const docHeight = document.documentElement.scrollHeight;
		const winHeight = window.innerHeight;
		maxScroll = Math.max(docHeight - winHeight - footerHeight, 1);

		windowWidth = window.innerWidth;
		updateIsMdUp();

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

	let rafId = 0;
	let lastTime = 0;

	const tick = (time: number) => {
		if (lastTime === 0) {
			lastTime = time;
			rafId = requestAnimationFrame(tick);
			return;
		}

		const delta = Math.min((time - lastTime) / 1000, 0.05);
		lastTime = time;

		// Scroll → line mapping (0–500px), excluding footer.
		const progress = clamp(0, window.scrollY / maxScroll, 1);
		const lineTarget = progress * LINE_HEIGHT;
		spring(line, lineTarget, SPRING_LINE.stiffness, SPRING_LINE.damping, delta);

		const overlayRect = overlayRef?.getBoundingClientRect();
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

		rafId = requestAnimationFrame(tick);
	};

	rafId = requestAnimationFrame(tick);

	return () => {
		window.removeEventListener('resize', updateMeasurements);
		window.removeEventListener('mousemove', handleMouseMove);
		observer.disconnect();
		cancelAnimationFrame(rafId);
	};
});
</script>

<div use:attachOverlay class="-translate-y-1/2 padding-standard pointer-events-none fixed top-1/2 left-0 z-20 h-[500px] w-full select-none">
	<div class="relative h-px w-full" style={lineStyle}>
		<div class="absolute inset-0 origin-left bg-black"></div>
		<div class="pointer-events-auto absolute top-[1px]" style={`left: ${anchorLeft}; ${ctaStyle}`}>
			{#if isIndexPage}
				<a class="-m-2.5 inline-block p-2.5" href="https://u29dc.co/hey" target="_blank" rel="noopener noreferrer">
					<div class="-translate-x-full whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white md:-translate-x-1/2">
						{ctaLabel}
					</div>
				</a>
			{:else}
				<a class="-m-2.5 inline-block p-2.5" href={resolve('/')}>
					<div class="-translate-x-full whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white md:-translate-x-1/2">
						{ctaLabel}
					</div>
				</a>
			{/if}
		</div>
	</div>
</div>
