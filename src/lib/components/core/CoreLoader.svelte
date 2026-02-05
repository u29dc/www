<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { loader } from "$lib/loader.svelte";
	import { registerRafTask } from "$lib/raf";
	import { TRANSITION } from "$lib/transition";

	// Reactive opacity based on loader state
	const opacity = $derived(loader.isActive ? 1 : 0);

	// Duration matches page transition
	const duration = TRANSITION.enterDuration;

	// Easing matches page transitions
	const easing = "var(--ease-settle)";

	// Skip animations for reduced motion users
	const skipAnimation = $derived(prefersReducedMotion.current);

	// Only use will-change during active state
	const willChange = $derived(loader.isActive ? "opacity" : "auto");

	// Pointer events: none after fade starts to not block interactions
	const pointerEvents = $derived(loader.isActive ? "auto" : "none");

	// Progress bar duration (matches hold duration in layout)
	const progressDuration = 2000;

	// Text animation configuration
	// Phase 1: 0-0.1 - fade in to initial squished/blurred state
	// Phase 2: 0.1-0.5 - staggered scale/blur reveal
	// Phase 3: 0.5-1 - text visible, progress bar continues
	const FADE_END = 0.1;
	const REVEAL_START = 0.1;
	const REVEAL_END = 0.5;

	// Split text into words, preserving structure for proper wrapping
	const text = "The technology works. The story doesn't.";
	const words = text.split(" ");
	const totalChars = text.length; // includes spaces

	// Each char's animation takes this portion of the reveal phase (normalized 0-1)
	const CHAR_ANIM_DURATION = 0.5;
	// Calculate stagger so all chars fit: (totalChars-1)*stagger + duration = 1.0
	const STAGGER_PER_CHAR = (1 - CHAR_ANIM_DURATION) / (totalChars - 1);

	// Calculate global character indices for stagger timing
	function getGlobalIndex(wordIndex: number, charIndex: number): number {
		let index = 0;
		for (let w = 0; w < wordIndex; w++) {
			const word = words[w];
			if (word) index += word.length + 1; // +1 for space
		}
		return index + charIndex;
	}

	// Calculate per-character animation progress within the reveal phase (0.1-0.5)
	function getCharProgress(globalIndex: number, globalProgress: number): number {
		if (globalProgress < REVEAL_START) return 0;
		if (globalProgress >= REVEAL_END) return 1;

		// Normalize global progress to 0-1 within reveal phase
		const revealProgress = (globalProgress - REVEAL_START) / (REVEAL_END - REVEAL_START);

		// Each char starts at staggered offset, last char ends exactly at 1.0
		const charStart = globalIndex * STAGGER_PER_CHAR;
		const charEnd = charStart + CHAR_ANIM_DURATION;

		if (revealProgress <= charStart) return 0;
		if (revealProgress >= charEnd) return 1;
		return (revealProgress - charStart) / CHAR_ANIM_DURATION;
	}

	// Generate inline styles for a character based on its animation progress
	function getCharStyle(charIndex: number): string {
		if (skipAnimation) return "";

		const progress = loader.progress;

		// Phase 1: Fade in (0 to 0.1) - fade to initial blurred state
		const fadeProgress = Math.min(progress / FADE_END, 1);

		// Phase 2: Reveal animation (0.1 to 0.5)
		const p = getCharProgress(charIndex, progress);

		// Scale: 0.1 -> 1 (scaleY), 1.5 -> 1 (scaleX)
		const scaleY = 0.1 + p * 0.9;
		const scaleX = 1.5 - p * 0.5;

		// Blur: 8px -> 0
		const blur = 8 * (1 - p);

		// Opacity: during fade phase go 0->0.5, during reveal go 0.5->1
		let charOpacity: number;
		if (progress < REVEAL_START) {
			charOpacity = fadeProgress * 0.5;
		} else {
			charOpacity = 0.5 + p * 0.5;
		}

		return `transform: scaleY(${scaleY}) scaleX(${scaleX}); filter: blur(${blur}px); opacity: ${charOpacity};`;
	}

	// RAF animation loop to drive progress using centralized RAF coordinator
	onMount(() => {
		if (skipAnimation || loader.hasCompleted) {
			loader.setProgress(1);
			return;
		}

		let startTime: number | null = null;

		const handle = registerRafTask((timestamp) => {
			if (startTime === null) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const p = Math.min(elapsed / progressDuration, 1);
			loader.setProgress(p);

			if (p >= 1) {
				handle.dispose();
			}
		});

		return () => handle.dispose();
	});
</script>

<!--
	CRITICAL: This element must have opacity:1 in the initial HTML
	to prevent content flash before JavaScript hydrates.

	The inline styles ensure the loader is visible immediately,
	then JavaScript takes over to fade it out.
-->
<div
	class="fixed inset-0 z-chrome bg-white"
	style="opacity: {opacity}; transition: {skipAnimation ? 'none' : `opacity ${duration}ms ${easing}`}; will-change: {willChange}; pointer-events: {pointerEvents};"
	aria-hidden={!loader.isActive}
	data-loader
>
	<!-- Grid matches Hero.svelte exactly for seamless visual handoff -->
	<div class="grid-page h-full">
		<div class="col-content flex h-full flex-col justify-center text-black">
			<h1 class="relative w-fit font-serif font-2xl bold">
				{#each words as word, wordIndex}
					<span class="inline-block whitespace-nowrap"
						>{#each word.split("") as char, charIndex}<span
								class="char"
								style={getCharStyle(getGlobalIndex(wordIndex, charIndex))}>{char}</span
							>{/each}</span
					>{#if wordIndex < words.length - 1}&nbsp;{/if}{#if word === "works."}<br class="sm:hidden" />{/if}
				{/each}
				<!-- Progress bar: 1px, animates width via scaleX for performance -->
				<span
					class="progress-bar absolute left-0 top-[calc(100%+0.5em)] h-px w-full origin-left bg-black"
					style="transform: scaleX({loader.progress});"
					aria-hidden="true"
				></span>
			</h1>
		</div>
	</div>
</div>

<style>
	.char {
		display: inline-block;
		will-change: transform, filter, opacity;
		transform-origin: center center;
	}

	@media (prefers-reduced-motion: reduce) {
		.char {
			transform: none !important;
			filter: none !important;
			opacity: 1 !important;
		}
	}
</style>
