<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { CDN } from "$lib/constants";
	import { loader } from "$lib/loader.svelte";
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

	// Parallax offsets (disabled under reduced motion)
	let parallaxY = $derived(
		prefersReducedMotion.current ? 0 : scrollY * PARALLAX.hero,
	);
	let contentParallaxY = $derived(
		prefersReducedMotion.current ? 0 : scrollY * PARALLAX.heroContent,
	);

	// Opacity values
	let contentOpacity = $derived(1 - progress);
	let overlayOpacity = $derived(progress);

	// Video should play when not fully faded out (progress < 1)
	let shouldPlay = $derived(progress < 1);

	// will-change cleanup: only apply during active animation (disabled under reduced motion)
	const willChangeActive = $derived(
		progress < 1 && !prefersReducedMotion.current,
	);

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
		const rafTask = registerRafTask(() => {
			scrollY = getInterpolatedScrollY();
		});

		const onResize = () => {
			viewportHeight = window.innerHeight;
		};

		window.addEventListener("resize", onResize, { passive: true });
		onResize();

		// Reset video to start when loader completes
		loader.onComplete(() => {
			if (videoRef) {
				videoRef.currentTime = 0;
			}
		});

		return () => {
			rafTask.dispose();
			window.removeEventListener("resize", onResize);
		};
	});
</script>

<!-- Fixed hero container -->
<div
	class="fixed inset-0 z-base h-screen overflow-hidden [background-color:var(--ground)]"
>
	<!-- Parallax video-->
	<!-- <video
		bind:this={videoRef}
		src="{CDN.mediaUrl}_HERO.webm"
		poster="{CDN.mediaUrl}_HERO.webp"
		autoplay
		muted
		loop
		playsinline
		disablepictureinpicture
		preload="metadata"
		class="pointer-events-none absolute inset-0 h-[calc(100%+25vh)] w-full object-cover grayscale transform-gpu"
		style="transform: translateY(-{parallaxY}px); will-change: {willChangeActive
			? 'transform'
			: 'auto'}"
	></video> -->

	<img
		src="{CDN.mediaUrl}_HERO.webp"
		alt=""
		fetchpriority="high"
		class="pointer-events-none absolute inset-0 h-[calc(100%+25vh)] w-full object-cover grayscale transform-gpu"
		style="transform: translateY(-{parallaxY}px); will-change: {willChangeActive
			? 'transform'
			: 'auto'}"
	/>

	<!-- White overlay that fades in as user scrolls -->
	<div
		class="absolute inset-0 [background-color:var(--hero-overlay)]"
		style="opacity: {overlayOpacity}; will-change: {willChangeActive
			? 'opacity'
			: 'auto'}"
		aria-hidden="true"
	></div>

	<!-- Content grid matching page layout -->
	<div
		class="relative z-content grid-page h-full"
		style="opacity: {contentOpacity}; transform: translateY(-{contentParallaxY}px); will-change: {willChangeActive
			? 'opacity, transform'
			: 'auto'}"
	>
		<div
			class="col-content flex h-full flex-col items-center justify-center text-center text-black"
		>
			<h1 class="w-full text-center font-serif font-2xl font-bold">
				The technology works.<br class="sm:hidden" /> The story doesn't.
			</h1>
		</div>
	</div>

	<!-- Scroll indicator at bottom -->
	<button
		type="button"
		onclick={scrollToSignal}
		class="absolute inset-x-0 bottom-8 z-content grid-page cursor-pointer rounded-full text-white focus-ring md:bottom-[120px]"
		style="opacity: {Math.max(
			0,
			1 - progress * 3,
		)}; will-change: {willChangeActive ? 'opacity' : 'auto'}"
		aria-label="Scroll to next section"
	>
		<div class="col-content flex justify-center">
			<ChevronDown size={24} strokeWidth={1.5} aria-hidden="true" />
		</div>
	</button>
</div>

<!-- Spacer to maintain scroll height (hero is fixed, so exits document flow) -->
<section id="hero" class="h-screen" aria-hidden="true"></section>
