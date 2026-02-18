<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { registerRafTask } from "$lib/raf";
	import { scrollLine } from "$lib/scrollline.svelte";

	const clamp = (min: number, value: number, max: number) =>
		Math.max(min, Math.min(value, max));

	const BUFFER = 200;

	let sectionRef = $state<HTMLElement | null>(null);
	let clipBottom = $state(0);
	let isNearSection = $state(false);
	let isDirectlyOnSection = $state(false);

	$effect(() => {
		scrollLine.setBlurActive(isDirectlyOnSection);
	});

	let sectionTop = 0;
	let sectionHeight = 0;

	onMount(() => {
		if (prefersReducedMotion.current) return;

		const updateRect = () => {
			if (!sectionRef) return;
			const rect = sectionRef.getBoundingClientRect();
			sectionTop = rect.top + window.scrollY;
			sectionHeight = rect.height;
		};

		updateRect();

		const observer = new ResizeObserver(updateRect);
		observer.observe(document.body);

		const rafHandle = registerRafTask(() => {
			const lineScreenY = scrollLine.screenY;
			const sectionScreenTop = sectionTop - window.scrollY;
			const clipY = lineScreenY - sectionScreenTop;

			clipBottom = clamp(0, sectionHeight - clipY, sectionHeight);
			isNearSection = clipY > -BUFFER && clipY < sectionHeight + BUFFER;
			isDirectlyOnSection = clipY > 0 && clipY < sectionHeight;
		});

		return () => {
			scrollLine.setBlurActive(false);
			observer.disconnect();
			rafHandle.dispose();
		};
	});
</script>

{#snippet content()}
	<header class="mb-16">
		<p class="font-mono text-muted">[ 01 SIGNAL ]</p>
	</header>

	<div class="font-lg font-medium space-y-8">
		<h2
			class="font-serif font-2xl font-bold underline decoration-1 underline-offset-4"
		>
			Most companies building complex technology can explain what they do.<br
			/>
			Fewer can make anyone feel why it matters.
		</h2>

		<p>
			The explanation is fluent — the team is credible, the market is
			real. But somewhere between what's been built and what the world
			believes, the signal breaks down.
		</p>

		<p>
			The usual response is to hire a brand agency. Compress everything
			into a tagline. Redesign the website. Shoot a launch film. It helps
			for a month. Then the same problem returns — because the problem was
			never the surface. It was the structure underneath.
		</p>

		<p>
			When the investor narrative says one thing, the customer story says
			another, and the careers page says a third, that's not a
			communications problem. It's a coherence problem. No amount of
			polish fixes architecture. The tagline doesn't hold because there's
			nothing underneath it to hold.
		</p>

		<p>
			What's missing is narrative architecture — the structural logic
			underneath how a company explains itself. Not a deck. Not a brand
			book no one opens after launch week. Decision-grade narratives your
			team can actually move on.
		</p>
	</div>
{/snippet}

{#if prefersReducedMotion.current}
	<section
		id="signal"
		class="col-content py-44 [content-visibility:auto] [contain-intrinsic-size:1000px_800px]"
	>
		{@render content()}
	</section>
{:else}
	<section
		bind:this={sectionRef}
		id="signal"
		class="relative col-content [content-visibility:auto] [contain-intrinsic-size:1000px_800px]"
	>
		<!-- Base: muted text (decorative, hidden from assistive tech) -->
		<div aria-hidden="true" class="py-44 text-black/10">
			{@render content()}
		</div>

		<!-- Reveal: full-contrast text (clipped at line position, semantic layer) -->
		<div
			class="pointer-events-none absolute inset-0 py-44"
			style:clip-path="inset(0 0 {clipBottom}px 0)"
			style:will-change={isNearSection ? "clip-path" : "auto"}
		>
			{@render content()}
		</div>
	</section>
{/if}
