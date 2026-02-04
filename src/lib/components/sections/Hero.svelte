<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { onMount } from 'svelte';

	const PARALLAX_FACTOR = 0.5; // image moves at half scroll speed

	let scrollY = $state(0);
	let viewportHeight = $state(800); // fallback, updated on mount

	// Scroll range = 50% of viewport height
	let scrollRange = $derived(viewportHeight * 0.5);

	// Progress from 0 to 1 over scroll range
	let progress = $derived(Math.min(Math.max(scrollY / scrollRange, 0), 1));

	// Parallax offset (image moves slower than scroll)
	let parallaxY = $derived(scrollY * PARALLAX_FACTOR);

	// Opacity values
	let contentOpacity = $derived(1 - progress);
	let overlayOpacity = $derived(progress);

	onMount(() => {
		const onScroll = () => {
			scrollY = window.scrollY;
		};

		const onResize = () => {
			viewportHeight = window.innerHeight;
		};

		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize, { passive: true });
		onScroll();
		onResize();

		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<!-- Fixed hero container -->
<div class="fixed inset-0 z-0 h-screen overflow-hidden">
	<!-- Parallax image -->
	<img
		src="https://cdn.sanity.io/images/3ccg9tet/production/85011037640cc82be8d86a3271a2c49909c60357-2048x1168.png"
		alt=""
		class="pointer-events-none absolute inset-0 h-[calc(100%+30vh)] w-full object-cover grayscale will-change-transform"
		style="transform: translateY(-{parallaxY}px)"
	/>

	<!-- White overlay that fades in as user scrolls -->
	<div class="absolute inset-0 bg-white will-change-[opacity]" style="opacity: {overlayOpacity}" aria-hidden="true"></div>

	<!-- Content grid matching page layout -->
	<div
		class="relative z-10 grid-page h-full will-change-[opacity,transform]"
		style="opacity: {contentOpacity}; transform: translateY(-{parallaxY * 0.3}px)"
	>
		<div class="col-content flex h-full flex-col justify-center gap-8 text-white">
			<h1 class="font-2xl font-medium max-w-3xl">The technology works. The story doesn't.</h1>
			<div aria-label="Scroll down">
				<ChevronDown size={24} strokeWidth={1.5} aria-hidden="true" />
			</div>
		</div>
	</div>
</div>

<!-- Spacer to maintain scroll height (hero is fixed, so exits document flow) -->
<section id="hero" class="h-screen" aria-hidden="true"></section>
