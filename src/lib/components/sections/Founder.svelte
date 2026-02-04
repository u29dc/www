<script lang="ts">
	import { onMount } from "svelte";
	import { CDN } from "$lib/constants";

	let sectionElement = $state<HTMLElement | null>(null);
	let scrollOffset = $state(0);
	let prefersReducedMotion = $state(false);

	onMount(() => {
		prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (prefersReducedMotion) return;

		const handleScroll = () => {
			if (!sectionElement) return;
			const rect = sectionElement.getBoundingClientRect();
			const viewportHeight = window.innerHeight;
			const progress = 1 - rect.top / viewportHeight;
			scrollOffset = Math.max(0, Math.min(1, progress)) * 30;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();

		return () => window.removeEventListener("scroll", handleScroll);
	});
</script>

<section id="founder" class="col-content py-32" bind:this={sectionElement}>
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 05 FOUNDER ]</h2>
	</header>

	<div
		class="grid gap-8 md:grid-cols-[auto_1fr] md:gap-12"
	>
		<div class="group relative w-full max-w-[200px] overflow-hidden">
			<img
				src={`${CDN.mediaUrl}_HAN.webp`}
				alt="Han, founder"
				loading="lazy"
				decoding="async"
				class="aspect-square w-full object-cover mix-blend-darken transition-all duration-500"
				style:transform={prefersReducedMotion
					? "none"
					: `translateY(${scrollOffset * 0.5}px)`}
			/>
			<div
				class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"
				aria-hidden="true"
			></div>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="font-subtitle">Han</h3>

			<div class="space-y-4 leading-relaxed text-muted">
				<p>
					Eight years across architecture, new media art, creative
					technology, and brand strategy — most recently three years
					inside Lotus Cars during their EV transformation. Each
					domain contributed a different fluency. Architecture:
					spatial narrative and systems thinking. New media art:
					technical decisions as conceptual carriers. Production:
					delivery under compression. Lotus: what happens when
					positioning meets reality at scale — where strategy breaks
					down, where execution reveals gaps, where the story is built
					or lost.
				</p>

				<p>
					The throughline is translation. Making complex ideas
					tangible for audiences who experience before they analyse.
					The interesting problems live where established disciplines
					fail to reach — and "disciplinary homeless" describes
					someone who carries enough fluency across boundaries to work
					in those gaps rather than around them.
				</p>
			</div>
		</div>
	</div>
</section>
