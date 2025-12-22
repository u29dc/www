<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { afterNavigate } from '$app/navigation';
import CoreGrainOverlay from '$lib/components/core/CoreGrainOverlay.svelte';
import { createScroll, type ScrollController } from '$lib/scroll';

let { children }: { children: Snippet } = $props();
let controller: ScrollController | null = null;

afterNavigate(() => {
	if (controller) {
		controller.jumpTo(0);
		return;
	}

	window.scrollTo(0, 0);
});

onMount(() => {
	const root = document.documentElement;
	requestAnimationFrame(() => {
		root.dataset.animateReady = 'true';
	});

	const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

	const syncController = () => {
		if (mediaQuery.matches) {
			controller?.destroy();
			controller = null;
			return;
		}

		if (!controller) {
			controller = createScroll({ lerp: 0.05 });
		}
	};

	syncController();

	const handleChange = () => {
		syncController();
	};

	mediaQuery.addEventListener('change', handleChange);

	return () => {
		mediaQuery.removeEventListener('change', handleChange);
		controller?.destroy();
		controller = null;
	};
});
</script>

{@render children()}

<CoreGrainOverlay
	intensity={0.5}
	grainScale={5.0}
	animationSpeed={0.1}
	exposure={0.1}
/>

<div class="grid-overlay" aria-hidden="true">
	<div class="grid-overlay-inner"></div>
</div>
