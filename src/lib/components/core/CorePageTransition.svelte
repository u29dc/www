<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import { prefersReducedMotion } from 'svelte/motion';
	import { TRANSITION } from '$lib/transition';
	import { resetScroll } from '$lib/scroll';

	let { children }: { children: Snippet } = $props();

	type Phase = 'idle' | 'exiting' | 'entering';
	let phase = $state<Phase>('idle');
	let pendingUrl: string | null = $state(null);

	beforeNavigate(({ to, cancel, willUnload }) => {
		// Skip for external links, reduced motion, or if already exiting
		if (willUnload || prefersReducedMotion.current || phase === 'exiting') return;
		// Skip if no destination
		if (!to?.url) return;

		// Cancel navigation to run exit animation
		cancel();
		pendingUrl = to.url.href;
		phase = 'exiting';

		// Navigate after exit animation completes
		setTimeout(() => {
			if (pendingUrl) {
				goto(pendingUrl, { replaceState: false });
				pendingUrl = null;
			}
		}, TRANSITION.exitDuration);
	});

	afterNavigate(() => {
		resetScroll();

		if (prefersReducedMotion.current) {
			phase = 'idle';
			return;
		}

		phase = 'entering';
		setTimeout(() => {
			phase = 'idle';
		}, TRANSITION.enterDuration);
	});

	// Opacity-only transition (no transform to preserve fixed positioning)
	const opacity = $derived(phase === 'exiting' ? 0 : 1);
	const duration = $derived(phase === 'exiting' ? TRANSITION.exitDuration : TRANSITION.enterDuration);
	const willChange = $derived(phase !== 'idle' ? 'opacity' : 'auto');
</script>

<div
	style:opacity
	style:transition="opacity {duration}ms var(--ease-out)"
	style:will-change={willChange}
>
	{@render children()}
</div>
