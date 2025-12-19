<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { createScroll, type ScrollController } from '$lib/scroll';

let { children }: { children: Snippet } = $props();

onMount(() => {
	let controller: ScrollController | null = null;
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

<div class="grid-overlay" aria-hidden="true">
	<div class="grid-overlay-inner"></div>
</div>
