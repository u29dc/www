<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { cubicInOut } from "svelte/easing";
	import type { TransitionConfig } from "svelte/transition";

	interface Props {
		text: string;
		duration?: number;
		respectReducedMotion?: boolean;
		class?: string;
	}

	interface MorphBlurParams {
		duration: number;
		blurPx?: number;
		startScale?: number;
	}

	let {
		text,
		duration = 180,
		respectReducedMotion = true,
		class: className = "",
	}: Props = $props();

	let prefersReducedMotion = $state(false);
	let mediaQuery: MediaQueryList | null = null;
	let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

	const transitionDuration = $derived(
		respectReducedMotion && prefersReducedMotion ? 0 : duration,
	);
	const exitDuration = $derived(Math.round(transitionDuration * 0.72));

	const morphBlur = (
		_node: Element,
		{ duration: transitionDurationMs, blurPx = 1.1, startScale = 0.985 }: MorphBlurParams,
	): TransitionConfig => ({
		duration: transitionDurationMs,
		easing: cubicInOut,
		css: (t) => {
			const scaleValue = startScale + (1 - startScale) * t;
			const blurValue = (1 - t) * blurPx;
			return `opacity: ${t}; transform: translate3d(0, 0, 0) scale(${scaleValue}); filter: blur(${blurValue}px);`;
		},
	});

	onMount(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function" ||
			!respectReducedMotion
		) {
			return;
		}

		mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		prefersReducedMotion = mediaQuery.matches;
		mediaListener = (event: MediaQueryListEvent): void => {
			prefersReducedMotion = event.matches;
		};
		mediaQuery.addEventListener("change", mediaListener);
	});

	onDestroy(() => {
		if (mediaQuery && mediaListener) {
			mediaQuery.removeEventListener("change", mediaListener);
		}
	});
</script>

<span class={`atomic-text-morph ${className}`}>
		{#key text}
			<span
				class="atomic-text-morph__item"
				in:morphBlur={{
					duration: transitionDuration,
					blurPx: 0.95,
					startScale: 0.988,
				}}
				out:morphBlur={{
					duration: exitDuration,
					blurPx: 1.15,
					startScale: 0.99,
				}}
			>
				{text}
			</span>
		{/key}
</span>

<style>
	.atomic-text-morph {
		display: inline-grid;
		place-items: center;
		line-height: inherit;
		white-space: nowrap;
	}

	.atomic-text-morph__item {
		display: inline-block;
		grid-area: 1 / 1;
		transform-origin: 50% 60%;
		will-change: transform, opacity, filter;
	}

	@media (prefers-reduced-motion: reduce) {
		.atomic-text-morph__item {
			will-change: auto;
		}
	}
</style>
