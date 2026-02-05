<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { CDN } from "$lib/constants";
	import { PARALLAX, SCROLL } from "$lib/motion";
	import { registerRafTask } from "$lib/raf";
	import { getInterpolatedScrollY } from "$lib/scroll";

	let scrollY = $state(0);
	let viewportHeight = $state(800); // fallback, updated on mount
	let videoRef = $state<HTMLVideoElement | null>(null);

	// Scroll range based on viewport height
	let scrollRange = $derived(viewportHeight * SCROLL.heroFadeRange);

	// Progress from 0 to 1 over scroll range
	let progress = $derived(Math.min(Math.max(scrollY / scrollRange, 0), 1));

	// Parallax offset (image moves slower than scroll)
	let parallaxY = $derived(scrollY * PARALLAX.hero);

	// Opacity values
	let contentOpacity = $derived(1 - progress);
	let overlayOpacity = $derived(progress);

	// Video should play when not fully faded out (progress < 1)
	let shouldPlay = $derived(progress < 1);

	// will-change cleanup: only apply during active animation (progress < 1 means hero visible)
	const willChangeActive = $derived(progress < 1);

	$effect(() => {
		if (!videoRef) return;
		if (shouldPlay) {
			videoRef.play().catch(() => {
				// autoplay may be blocked by browser policy
			});
		} else {
			videoRef.pause();
		}
	});

	const scrollToSignal = () => {
		const signal = document.getElementById("signal");
		signal?.scrollIntoView({ behavior: "smooth" });
	};

	onMount(() => {
		if (prefersReducedMotion.current) return;

		const rafTask = registerRafTask(() => {
			scrollY = getInterpolatedScrollY();
		});

		const onResize = () => {
			viewportHeight = window.innerHeight;
		};

		window.addEventListener("resize", onResize, { passive: true });
		onResize();

		return () => {
			rafTask.dispose();
			window.removeEventListener("resize", onResize);
		};
	});
</script>

<!-- Fixed hero container -->
<div class="fixed inset-0 z-0 h-screen overflow-hidden">
	<!-- Parallax video-->
	<!-- <video
		bind:this={videoRef}
		src="{CDN.mediaUrl}_HERO.webm"
		autoplay
		muted
		loop
		playsinline
		disablepictureinpicture
		preload="auto"
		class="pointer-events-none absolute inset-0 h-[calc(100%+25vh)] w-full object-cover grayscale will-change-transform"
		style="transform: translateY(-{parallaxY}px)"
	></video> -->

	<img
		src="{CDN.mediaUrl}_HERO.webp"
		alt=""
		fetchpriority="high"
		class="pointer-events-none absolute inset-0 h-[calc(100%+25vh)] w-full object-cover grayscale transform-gpu"
		style="transform: translateY(-{parallaxY}px); will-change: {willChangeActive ? 'transform' : 'auto'}"
	/>

	<!-- White overlay that fades in as user scrolls -->
	<div
		class="absolute inset-0 bg-white"
		style="opacity: {overlayOpacity}; will-change: {willChangeActive ? 'opacity' : 'auto'}"
		aria-hidden="true"
	></div>

	<!-- Content grid matching page layout -->
	<div
		class="relative z-10 grid-page h-full"
		style="opacity: {contentOpacity}; transform: translateY(-{scrollY * PARALLAX.heroContent}px); will-change: {willChangeActive ? 'opacity, transform' : 'auto'}"
	>
		<div class="col-content flex h-full flex-col justify-center text-white">
			<h1 class="font-serif font-2xl bold">
				The technology works.<br class="sm:hidden" /> The story doesn't.
			</h1>
		</div>
	</div>

	<!-- Scroll indicator at bottom -->
	<button
		type="button"
		onclick={scrollToSignal}
		class="absolute inset-x-0 bottom-8 z-10 flex cursor-pointer justify-center rounded-full text-white focus-ring md:bottom-[120px] md:grid-page md:justify-start"
		style="opacity: {Math.max(0, 1 - progress * 3)}; will-change: {willChangeActive ? 'opacity' : 'auto'}"
		aria-label="Scroll to next section"
	>
		<div class="md:col-content">
			<ChevronDown size={24} strokeWidth={1.5} aria-hidden="true" />
		</div>
	</button>
</div>

<!-- Spacer to maintain scroll height (hero is fixed, so exits document flow) -->
<section id="hero" class="h-screen" aria-hidden="true"></section>
