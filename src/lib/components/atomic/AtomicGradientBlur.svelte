<script lang="ts">
	import type { Snippet } from "svelte";
	import { onMount } from "svelte";

	export type BlurPosition = "top" | "bottom" | "left" | "right";
	export type BlurCurve = "linear" | "ease-in" | "ease-out" | "bezier";

	type Props = {
		position?: BlurPosition;
		strength?: number;
		size?: string;
		layers?: number;
		curve?: BlurCurve;
		exponential?: boolean;
		animated?: boolean;
		opacity?: number;
		fixed?: boolean;
		zIndex?: number;
		className?: string;
		children?: Snippet;
	};

	const {
		position = "bottom",
		strength = 3,
		size = "6rem",
		layers = 5,
		curve = "bezier",
		exponential = true,
		animated = false,
		opacity = 1,
		fixed = true,
		zIndex = 0,
		className = "",
		children,
	}: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let isVisible = $state(true);

	$effect(() => {
		isVisible = !animated;
	});

	const applyCurve = (progress: number, selected: BlurCurve): number => {
		switch (selected) {
			case "linear":
				return progress;
			case "ease-in":
				return progress * progress;
			case "ease-out":
				return 1 - (1 - progress) ** 2;
			case "bezier":
				return progress * progress * (3 - 2 * progress);
			default:
				return progress;
		}
	};

	const calculateBlur = (
		layerIndex: number,
		totalLayers: number,
		intensity: number,
		selected: BlurCurve,
		useExponential: boolean,
	): number => {
		const progress = (layerIndex + 1) / totalLayers;
		const curvedProgress = applyCurve(progress, selected);

		if (useExponential) {
			return 2 ** (curvedProgress * 4) * 0.0625 * intensity;
		}

		return 0.0625 * (curvedProgress * totalLayers + 1) * intensity;
	};

	const getGradientDirection = (selected: BlurPosition): string => {
		const directions: Record<BlurPosition, string> = {
			top: "to top",
			bottom: "to bottom",
			left: "to left",
			right: "to right",
		};
		return directions[selected];
	};

	const generateMaskGradient = (
		layerIndex: number,
		totalLayers: number,
	): string => {
		const increment = 100 / totalLayers;
		const start = Math.round(increment * layerIndex * 10) / 10;
		const middle = Math.round(increment * (layerIndex + 1) * 10) / 10;
		const end = Math.round(increment * (layerIndex + 2) * 10) / 10;
		const final = Math.round(increment * (layerIndex + 3) * 10) / 10;

		let gradient = `transparent ${start}%, black ${middle}%`;
		if (end <= 100) gradient += `, black ${end}%`;
		if (final <= 100) gradient += `, transparent ${final}%`;
		return gradient;
	};

	const isVertical = $derived(position === "top" || position === "bottom");
	const direction = $derived(getGradientDirection(position));
	const layerStyles = $derived(
		Array.from({ length: layers }, (_, index) => {
			const blurValue = calculateBlur(
				index,
				layers,
				strength,
				curve,
				exponential,
			);
			const maskGradient = generateMaskGradient(index, layers);
			return [
				`mask-image: linear-gradient(${direction}, ${maskGradient})`,
				`-webkit-mask-image: linear-gradient(${direction}, ${maskGradient})`,
				`backdrop-filter: blur(${blurValue.toFixed(3)}rem)`,
				`opacity: ${opacity}`,
				"transform: translateZ(0)",
				"will-change: transform",
			].join("; ");
		}),
	);

	const containerStyle = $derived(
		[
			`position: ${fixed ? "fixed" : "absolute"}`,
			"pointer-events: none",
			`opacity: ${isVisible ? 1 : 0}`,
			`transition: ${animated ? "opacity 0.3s ease-out" : "none"}`,
			`z-index: ${zIndex}`,
			"contain: layout style paint",
			`${position}: 0`,
			isVertical
				? `height: ${size}; width: 100%; left: 0; right: 0`
				: `width: ${size}; height: 100%; top: 0; bottom: 0`,
		].join("; "),
	);

	onMount(() => {
		if (!animated || !container) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry) {
					isVisible = entry.isIntersecting;
				}
			},
			{ threshold: 0.1 },
		);

		observer.observe(container);

		return () => {
			observer.disconnect();
		};
	});
</script>

<div
	bind:this={container}
	class={`relative isolate hidden md:block ${className}`}
	style={containerStyle}
>
	<div class="full-container relative">
		{#each layerStyles as layerStyle}
			<div class="absolute inset-0" style={layerStyle}></div>
		{/each}
	</div>
	{#if children}
		<div class="relative">
			{@render children()}
		</div>
	{/if}
</div>
