<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
	import { CDN } from "$lib/constants";
	import { MAGNETIC } from "$lib/motion";
	import { registerRafTask } from "$lib/raf";
	import { type SpringState, SPRING_PARALLAX, spring } from "$lib/springs";
	import { theme } from "$lib/theme.svelte";

	const PHOTO_SCALE = 1.2;

	let photoRef = $state<HTMLDivElement | null>(null);
	let offsetX = $state(0);
	let offsetY = $state(0);

	onMount(() => {
		if (prefersReducedMotion.current) return;

		// Only run magnetic parallax on devices with precise pointer (mouse/trackpad)
		// Touch devices never fire mousemove, so RAF task would run 60fps for nothing
		const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
		if (!hasFinePointer) return;

		let photoRect: DOMRect | null = null;
		let pointerX = 0;
		let pointerY = 0;
		const springX: SpringState = { value: 0, velocity: 0 };
		const springY: SpringState = { value: 0, velocity: 0 };

		const updateRect = () => {
			photoRect = photoRef?.getBoundingClientRect() ?? null;
		};

		const handleMouseMove = (e: MouseEvent) => {
			pointerX = e.clientX;
			pointerY = e.clientY;
		};

		const tick = (_time: number, delta: number) => {
			if (!photoRect || delta === 0) return;
			const d = Math.min(delta, 0.05);

			// Center of photo element
			const centerX = photoRect.left + photoRect.width / 2;
			const centerY = photoRect.top + photoRect.height / 2;

			// Distance and direction
			const dx = pointerX - centerX;
			const dy = pointerY - centerY;
			const distance = Math.hypot(dx, dy);

			// Strength falls off with smooth cubic ease (no harsh boundary)
			const t = Math.min(1, distance / MAGNETIC.originRadius);
			const strength = 1 - t * t * (3 - 2 * t); // smoothstep for gradual fade

			// Gentle targets with soft directional bias
			const targetX =
				(dx / Math.max(distance, 1)) *
				MAGNETIC.originMaxOffset *
				strength *
				Math.min(1, distance * 0.005);
			const targetY =
				(dy / Math.max(distance, 1)) *
				MAGNETIC.originMaxOffset *
				strength *
				Math.min(1, distance * 0.005);

			spring(springX, targetX, SPRING_PARALLAX.heavy, d);
			spring(springY, targetY, SPRING_PARALLAX.heavy, d);

			offsetX = springX.value;
			offsetY = springY.value;
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("resize", updateRect);
		window.addEventListener("scroll", updateRect, { passive: true });
		updateRect();

		const rafHandle = registerRafTask(tick);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("resize", updateRect);
			window.removeEventListener("scroll", updateRect);
			rafHandle.dispose();
		};
	});
</script>

<section id="origin" class="grid-section-full py-44">
	<header class="col-content mb-16">
		<p class="font-mono text-muted">[ 03 ORIGIN ]</p>
	</header>

	<div class="col-content grid-content-tracks items-start gap-y-8 md:gap-y-0">
		<div
			class="col-span-full group relative w-full max-w-[200px] overflow-hidden rounded-sm md:col-span-2 md:max-w-none lg:col-span-2 lg:max-w-[220px] 2xl:col-span-1 4xl:col-span-1 4xl:max-w-none"
			bind:this={photoRef}
		>
			<img
				src={`${CDN.mediaUrl}_HAN.webp`}
				alt="Han"
				loading="lazy"
				decoding="async"
				class="aspect-square w-full origin-center object-cover {theme.resolved ===
				'dark'
					? 'mix-blend-screen'
					: 'mix-blend-darken'}"
				style:transform={prefersReducedMotion.current
					? "none"
					: `scale(${PHOTO_SCALE}) translate3d(${offsetX}px, ${offsetY}px, 0)`}
			/>
			<div
				class="pointer-events-none absolute inset-0 {theme.resolved ===
				'dark'
					? 'bg-gradient-to-t from-white/10 to-transparent'
					: 'bg-gradient-to-t from-black/10 to-transparent'}"
				aria-hidden="true"
			></div>
		</div>

		<div class="col-span-full flex flex-col gap-4 md:col-span-4 lg:col-span-2 2xl:col-span-3 4xl:col-span-1">
			<h2 class="font-subtitle">Han</h2>

			<div class="space-y-4 leading-relaxed text-muted">
				<p>
					Eight years across architecture, new media art, creative
					technology, and brand strategy — most recently three years
					inside Lotus Cars during their EV transformation.
				</p>

				<p>
					The interesting problems live where established disciplines
					fail to reach — and "disciplinary homeless" describes
					someone who carries enough fluency across boundaries to work
					in those gaps rather than around them.
				</p>
			</div>

			<a
				href="https://linkedin.com/in/u29dc"
				target="_blank"
				rel="noopener noreferrer"
				class="group/link mt-2 inline-flex w-fit items-center gap-1 text-muted transition-colors duration-150 hover:text-foreground"
			>
				<span>Follow on LinkedIn</span>
				<ArrowUpRight
					class="size-4 transition-transform duration-150 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
				/>
			</a>
		</div>
	</div>
</section>
