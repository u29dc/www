<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/stores";
	import { prefersReducedMotion } from "svelte/motion";
	import { loader } from "$lib/loader.svelte";
	import { registerRafTask } from "$lib/raf";
	import { TRANSITION } from "$lib/transition";

	// Reactive opacity based on loader state
	const opacity = $derived(loader.isActive ? 1 : 0);

	// Loader fade-out duration: slower on home for dramatic effect, slug pages match page transition
	const duration = $derived(
		$page.url.pathname === "/"
			? TRANSITION.exitDuration * 2
			: TRANSITION.exitDuration,
	);

	// Smooth easing for perceptible fade-out (ease-settle is too aggressive, reaches 90% in first 10%)
	const easing = "var(--ease-smooth)";

	// Skip animations for reduced motion users
	const skipAnimation = $derived(prefersReducedMotion.current);

	// Reveal animation version: 1 = blur+brightness only, 2 = scale+blur
	const REVEAL_VERSION: 1 | 2 = 1;

	// Tip opacity: visible during progress, fades out at completion
	const tipOpacity = $derived(
		skipAnimation ? 0 : loader.progress >= 1 ? 0 : 1,
	);

	// Only use will-change during active state
	const willChange = $derived(loader.isActive ? "opacity" : "auto");

	// Pointer events: none after fade starts to not block interactions
	const pointerEvents = $derived(loader.isActive ? "auto" : "none");

	// Progress bar duration (2.5s progress + 0.5s hold = 3s total in layout)
	const progressDuration = 2500;

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
	function getCharProgress(
		globalIndex: number,
		globalProgress: number,
	): number {
		if (globalProgress < REVEAL_START) return 0;
		if (globalProgress >= REVEAL_END) return 1;

		// Normalize global progress to 0-1 within reveal phase
		const revealProgress =
			(globalProgress - REVEAL_START) / (REVEAL_END - REVEAL_START);

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

		if (REVEAL_VERSION === 1) {
			// Effect 1: Blur + Brightness with lookahead window
			const blur = 10 * (1 - p);
			const brightness = p * 100;

			// Lookahead: chars become visible only when near their animation start
			const LOOKAHEAD_CHARS = 2;
			const lookaheadWindow = LOOKAHEAD_CHARS * STAGGER_PER_CHAR;

			let charOpacity: number;
			if (progress < REVEAL_START) {
				// During initial fade, only first few chars visible
				const charStart = charIndex * STAGGER_PER_CHAR;
				if (charStart > lookaheadWindow) {
					charOpacity = 0;
				} else {
					charOpacity =
						fadeProgress * 0.3 * (1 - charStart / lookaheadWindow);
				}
			} else if (p === 0) {
				// Not yet animating - check if within lookahead window
				const revealProgress =
					(progress - REVEAL_START) / (REVEAL_END - REVEAL_START);
				const charStart = charIndex * STAGGER_PER_CHAR;
				const distance = charStart - revealProgress;

				if (distance > lookaheadWindow) {
					charOpacity = 0; // Too far ahead, invisible
				} else if (distance > 0) {
					// Within lookahead - fade in based on proximity
					charOpacity = 0.3 * (1 - distance / lookaheadWindow);
				} else {
					charOpacity = 0.3; // At or past start point
				}
			} else {
				// Animating - normal reveal
				charOpacity = 0.3 + p * 0.7;
			}

			return `filter: blur(${blur}px) brightness(${brightness}%); opacity: ${charOpacity};`;
		}

		// Effect 2 (default): Scale + Blur - squished/stretched emergence
		const scaleY = 0.1 + p * 0.9;
		const scaleX = 1.5 - p * 0.5;
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
	style="opacity: {opacity}; transition: {skipAnimation
		? 'none'
		: `opacity ${duration}ms ${easing}`}; will-change: {willChange}; pointer-events: {pointerEvents};"
	aria-hidden={!loader.isActive}
	data-loader
>
	<!-- Grid matches Hero.svelte exactly for seamless visual handoff -->
	<div class="grid-page h-full">
		<div
			class="col-content flex h-full flex-col items-center justify-center text-center text-black"
		>
			<h1
				class="relative w-full text-center font-serif font-2xl font-bold"
			>
				{#each words as word, wordIndex}
					<span class="inline-block whitespace-nowrap"
						>{#each word.split("") as char, charIndex}<span
								class="char"
								style={getCharStyle(
									getGlobalIndex(wordIndex, charIndex),
								)}>{char}</span
							>{/each}</span
					>{#if wordIndex < words.length - 1}&nbsp;{/if}{#if word === "works."}<br
							class="sm:hidden"
						/>{/if}
				{/each}
				<!-- Progress bar: 1px, animates width via scaleX for performance -->
				<span
					class="progress-bar absolute left-0 top-[calc(100%+0.5em)] h-px w-full origin-left bg-black"
					style="transform: scaleX({loader.progress});"
					aria-hidden="true"
				></span>
				<!-- Blurred leading edge tip for soft "painting" effect -->
				<span
					class="progress-tip absolute top-[calc(100%+0.5em)] h-px"
					style="left: {loader.progress *
						100}%; opacity: {tipOpacity};"
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

	.progress-tip {
		width: 8px;
		background: linear-gradient(to right, black, transparent);
		filter: blur(2.5px);
		transform: translateX(-100%);
		transition: opacity 150ms ease-out;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.char {
			transform: none !important;
			filter: none !important;
			opacity: 1 !important;
		}

		.progress-tip {
			display: none;
		}
	}
</style>
