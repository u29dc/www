<script lang="ts">
	import type { Snippet } from "svelte";
	import { goto, beforeNavigate, afterNavigate } from "$app/navigation";
	import { prefersReducedMotion } from "svelte/motion";
	import { TRANSITION } from "$lib/transition";
	import { resetScroll } from "$lib/scroll";

	let { children }: { children: Snippet } = $props();

	type Phase = "idle" | "exiting" | "entering";
	let phase = $state<Phase>("idle");
	let pendingUrl: string | null = $state(null);

	beforeNavigate(({ to, cancel, willUnload }) => {
		// Skip for external links, reduced motion, or if already exiting
		if (willUnload || prefersReducedMotion.current || phase === "exiting")
			return;
		// Skip if no destination
		if (!to?.url) return;

		// Cancel navigation to run exit animation
		cancel();
		pendingUrl = to.url.href;
		phase = "exiting";

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

		// Focus main content for keyboard/screen reader users
		requestAnimationFrame(() => {
			const main = document.getElementById("main-content");
			main?.focus({ preventScroll: true });
		});

		if (prefersReducedMotion.current) {
			phase = "idle";
			return;
		}

		phase = "entering";
		setTimeout(() => {
			phase = "idle";
		}, TRANSITION.enterDuration);
	});

	// Opacity-only transition (no transform to preserve fixed positioning)
	const opacity = $derived(phase === "exiting" ? 0 : 1);
	const duration = $derived(
		phase === "exiting"
			? TRANSITION.exitDuration
			: TRANSITION.enterDuration,
	);
	// Use ease-settle (deceleration) for both phases:
	// Exit: quickly begins fading, gently disappears (no lingering)
	// Enter: quickly appears, gently settles (immediate feedback)
	const easing = "var(--ease-settle)";
	const willChange = $derived(phase !== "idle" ? "opacity" : "auto");
</script>

<div
	style:opacity
	style:transition="opacity {duration}ms {easing}"
	style:will-change={willChange}
>
	{@render children()}
</div>
