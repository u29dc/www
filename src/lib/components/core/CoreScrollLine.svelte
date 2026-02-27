<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { page } from "$app/state";
	import { MAGNETIC, SCROLL } from "$lib/motion";
	import { registerRafTask } from "$lib/raf";
	import { getScrollY } from "$lib/scroll";
	import { scrollLine } from "$lib/scrollline.svelte";
	import { type SpringState, SPRING_UI, spring } from "$lib/springs";
	import AtomicGradientBlur from "$lib/components/atomic/AtomicGradientBlur.svelte";

	const isSlugPage = $derived(page.route.id === "/[slug]");

	const LINE_HEIGHT = 600;
	const BASE_RANGE = 50;
	const BASE_TANH_SCALE = 0.003;

	const clamp = (min: number, value: number, max: number) =>
		Math.max(min, Math.min(value, max));

	let overlayRef = $state<HTMLDivElement | null>(null);
	let isMdUp = $state(false);
	let lineOffset = $state(0);
	let ctaOffset = $state(0);
	let isVisible = $state(false);
	let overlayRect: DOMRect | null = null;

	const lineStyle = $derived(
		`transform: translate3d(0, ${lineOffset}px, 0);`,
	);
	const ctaStyle = $derived(`transform: translate3d(${ctaOffset}px, 0, 0);`);
	const anchorLeft = $derived(isMdUp ? "20%" : "100%");

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
			isVisible = true;
		}

		const updateIsMdUp = () => {
			isMdUp = window.matchMedia("(min-width: 768px)").matches;
		};

		let maxScroll = 1000;
		let scrollStart = 0;
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
			const footer = document.querySelector(
				'[data-section="footer"]',
			) as HTMLElement | null;
			const footerHeight = footer?.getBoundingClientRect().height ?? 0;
			const docHeight = document.documentElement.scrollHeight;
			const winHeight = window.innerHeight;

			// Scroll range excludes hero (starts when hero is half-scrolled)
			scrollStart = winHeight * SCROLL.lineScrollStart;
			maxScroll = Math.max(
				docHeight - winHeight - footerHeight - scrollStart,
				1,
			);

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

		window.addEventListener("resize", updateMeasurements);
		window.addEventListener("mousemove", handleMouseMove);

		const observer = new ResizeObserver(updateMeasurements);
		observer.observe(document.body);

		const tick = (_time: number, deltaSeconds: number) => {
			if (deltaSeconds === 0) return;

			const delta = Math.min(deltaSeconds, 0.05);
			const winHeight = window.innerHeight;

			// Line visibility: immediate on slug pages, fade in after hero on homepage
			const scrollY = getScrollY();
			isVisible =
				isSlugPage || scrollY > winHeight * SCROLL.lineVisibleThreshold;

			// Scroll progress mapped from after hero to footer
			const adjustedScroll = Math.max(0, scrollY - scrollStart);
			const progress = clamp(0, adjustedScroll / maxScroll, 1);
			const lineTarget = progress * LINE_HEIGHT;
			spring(line, lineTarget, SPRING_UI.line, delta);

			const anchorX = overlayRect
				? isMdUp
					? overlayRect.width * 0.2
					: overlayRect.width
				: isMdUp
					? windowWidth * 0.2
					: windowWidth;
			const anchorY = overlayRect
				? overlayRect.top + line.value + magnetY.value
				: line.value;

			// Base follow (soft clamp) + magnetic offset
			const baseAnchor = windowWidth * 0.2;
			const baseDiff = mouseX - baseAnchor;
			const baseTarget = isMdUp
				? Math.tanh(baseDiff * BASE_TANH_SCALE) * BASE_RANGE
				: 0;
			spring(base, baseTarget, SPRING_UI.base, delta);

			const dx = pointerX - anchorX;
			const dy = pointerY - anchorY;
			const distance = Math.hypot(dx, dy);
			const strength = Math.max(0, 1 - distance / MAGNETIC.lineRadius);
			const magnetTargetX =
				Math.tanh((dx / Math.max(distance, 1)) * 2) *
				MAGNETIC.lineXRange *
				strength;
			const magnetTargetY =
				Math.tanh((dy / Math.max(distance, 1)) * 2) *
				MAGNETIC.lineYRange *
				strength;
			spring(magnetX, magnetTargetX, SPRING_UI.magnet, delta);
			spring(magnetY, magnetTargetY, SPRING_UI.magnet, delta);

			lineOffset = line.value + magnetY.value;
			ctaOffset = (isMdUp ? base.value : 0) + magnetX.value;
			scrollLine.setScreenY(winHeight / 2 - 250 + lineOffset);
		};

		rafHandle = registerRafTask(tick);

		return () => {
			window.removeEventListener("resize", updateMeasurements);
			window.removeEventListener("mousemove", handleMouseMove);
			observer.disconnect();
			rafHandle?.dispose();
			rafHandle = null;
		};
	});
</script>

<div
	use:attachOverlay
	class="pointer-events-none fixed top-1/2 left-0 z-overlay h-[400px] w-full -translate-y-[250px] select-none transition-opacity duration-300"
	style:opacity={isVisible ? 1 : 0}
>
	<div
		class="relative h-px w-full"
		style="{lineStyle}; will-change: transform; backface-visibility: hidden;"
	>
		<div
			class="pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out"
			style:opacity={scrollLine.blurOpacity}
		>
			<AtomicGradientBlur
				position="bottom"
				fixed={false}
				size="4rem"
				strength={1}
				layers={2}
			/>
		</div>
		<div
			class="absolute inset-0 z-10 origin-left transform-gpu [background-color:var(--line-ink)]"
			style="will-change: transform; backface-visibility: hidden;"
		></div>
		<div
			class="pointer-events-none absolute inset-0 transition-opacity duration-200 ease-out"
			style:opacity={scrollLine.blurOpacity}
		>
			<AtomicGradientBlur
				position="top"
				fixed={false}
				size="10rem"
				strength={3}
				layers={2}
			/>
		</div>
		<div
			class="pointer-events-auto absolute top-[1px] transform-gpu"
			style="left: {anchorLeft}; {ctaStyle}; will-change: transform; backface-visibility: hidden;"
		>
			<a
				class="-m-2.5 inline-block p-2.5"
				href="https://cal.com/u29dc/hey"
				target="_blank"
				rel="noopener noreferrer"
				>
					<div
						class="-translate-x-full whitespace-nowrap px-3 py-2 font-mono text-sm md:-translate-x-1/2 [background-color:var(--ui-contrast-bg)] [color:var(--ui-contrast-fg)]"
					>
						BOOK A CALL
					</div>
			</a>
		</div>
	</div>
</div>
