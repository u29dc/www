<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { registerRafTask } from "$lib/raf";
	import { getInterpolatedScrollY, smoothScrollToTop } from "$lib/scroll";
	import { type SpringState, SPRING_UI, spring } from "$lib/springs";

	export interface CoreScrollProgressProps {
		/** Additional Tailwind classes */
		className?: string;
	}

	let { className = "" }: CoreScrollProgressProps = $props();

	const LINE_HEIGHT = 60;
	const SHOW_THRESHOLD = 0.5;
	const HIDE_NEAR_BOTTOM = 100;

	let isVisible = $state(false);
	let progress = $state(0);
	let dotOffset = $state(0);

	const lineStyle = $derived(`height: ${LINE_HEIGHT}px;`);
	const dotStyle = $derived(`transform: translate3d(0, ${dotOffset}px, 0);`);

	const handleBackToTop = () => {
		smoothScrollToTop();
	};

	onMount(() => {
		if (prefersReducedMotion.current) {
			return;
		}

		const dot: SpringState = { value: 0, velocity: 0 };

		const tick = (_time: number, deltaSeconds: number) => {
			if (deltaSeconds === 0) return;

			const delta = Math.min(deltaSeconds, 0.05);
			const scrollY = getInterpolatedScrollY();
			const winHeight = window.innerHeight;
			const docHeight = document.documentElement.scrollHeight;
			const maxScroll = Math.max(docHeight - winHeight, 1);

			const showThreshold = winHeight * SHOW_THRESHOLD;
			const hideThreshold = maxScroll - HIDE_NEAR_BOTTOM;

			isVisible = scrollY > showThreshold && scrollY < hideThreshold;

			progress = Math.min(scrollY / maxScroll, 1);
			const dotTarget = progress * (LINE_HEIGHT - 4);
			spring(dot, dotTarget, SPRING_UI.line, delta);
			dotOffset = dot.value;
		};

		const rafHandle = registerRafTask(tick);

		return () => {
			rafHandle.dispose();
		};
	});
</script>

<div
	class="pointer-events-none fixed right-4 bottom-8 z-chrome select-none transition-opacity duration-300 {className}"
	style:opacity={isVisible ? 1 : 0}
>
	<div class="flex flex-col items-center gap-2">
		<div class="relative w-px bg-black/10" style={lineStyle}>
			<div
				class="absolute top-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-black"
				style="{dotStyle}; will-change: transform; backface-visibility: hidden;"
			></div>
		</div>
		<button
			type="button"
			onclick={handleBackToTop}
			class="pointer-events-auto -m-2 cursor-pointer p-2 font-mono text-[10px] tracking-wider text-black/60 transition-colors duration-150 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
			aria-label="Scroll to top"
		>
			TOP
		</button>
	</div>
</div>
