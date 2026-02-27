<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { registerRafTask } from "$lib/raf";
	import { scrollLine } from "$lib/scrollline.svelte";

	const clamp = (min: number, value: number, max: number) =>
		Math.max(min, Math.min(value, max));

	const CLIP_WILL_CHANGE_BUFFER = 200;
	const BLUR_ACTIVE_BUFFER_TOP = 150;
	const BLUR_ACTIVE_BUFFER_BOTTOM = 100;
	const BLUR_FADE_DISTANCE = 180;

	const smoothstep = (min: number, max: number, value: number) => {
		if (min === max) return value < min ? 0 : 1;
		const t = clamp(0, (value - min) / (max - min), 1);
		return t * t * (3 - 2 * t);
	};

	const getBlurOpacity = (clipY: number, height: number) => {
		if (height <= 0) return 0;

		const activeStart = -BLUR_ACTIVE_BUFFER_TOP;
		const activeEnd = height + BLUR_ACTIVE_BUFFER_BOTTOM;

		if (clipY >= activeStart && clipY <= activeEnd) {
			return 1;
		}

		if (clipY < activeStart) {
			return smoothstep(
				activeStart - BLUR_FADE_DISTANCE,
				activeStart,
				clipY,
			);
		}

		return 1 - smoothstep(activeEnd, activeEnd + BLUR_FADE_DISTANCE, clipY);
	};

	let sectionRef = $state<HTMLElement | null>(null);
	let clipBottom = $state(0);
	let blurOpacity = $state(0);
	let isNearSection = $state(false);

	$effect(() => {
		scrollLine.setBlurOpacity(blurOpacity);
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
			blurOpacity = getBlurOpacity(clipY, sectionHeight);
			isNearSection =
				clipY > -CLIP_WILL_CHANGE_BUFFER &&
				clipY < sectionHeight + CLIP_WILL_CHANGE_BUFFER;
		});

		return () => {
			scrollLine.setBlurOpacity(0);
			observer.disconnect();
			rafHandle.dispose();
		};
	});
</script>

{#snippet headerContent()}
	<header class="col-content mb-16">
		<p class="font-mono text-muted">[ 00 SIGNAL ]</p>
	</header>
{/snippet}

{#snippet bodyContent()}
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

<section id="signal" class="grid-section-full py-44">
	{@render headerContent()}

	{#if prefersReducedMotion.current}
		<div
			class="col-content [content-visibility:auto] [contain-intrinsic-size:1000px_800px]"
		>
			{@render bodyContent()}
		</div>
	{:else}
		<div
			bind:this={sectionRef}
			class="relative col-content [content-visibility:auto] [contain-intrinsic-size:1000px_800px]"
		>
			<!-- Base: muted text (decorative, hidden from assistive tech) -->
			<div aria-hidden="true" class="text-foreground/10">
				{@render bodyContent()}
			</div>

			<!-- Reveal: full-contrast text (clipped at line position, semantic layer) -->
			<div
				class="pointer-events-none absolute inset-0"
				style:clip-path="inset(0 0 {clipBottom}px 0)"
				style:will-change={isNearSection ? "clip-path" : "auto"}
			>
				{@render bodyContent()}
			</div>
		</div>
	{/if}
</section>
