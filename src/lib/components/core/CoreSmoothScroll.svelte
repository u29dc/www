<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { registerRafTask } from '$lib/raf';
	import { setLenisInstance } from '$lib/scroll';
	import Lenis from 'lenis';

	const isTouchDevice = () => {
		return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
	};

	onMount(() => {
		// Skip on touch devices (preserve native scroll: momentum, rubber banding, pinch-to-zoom)
		// Skip if user prefers reduced motion (accessibility requirement)
		if (isTouchDevice() || prefersReducedMotion.current) {
			return;
		}

		const lenis = new Lenis({
			lerp: 0.08,
			duration: 1.2,
			smoothWheel: true,
			autoRaf: false,
			orientation: 'vertical',
			gestureOrientation: 'vertical',
		});

		// Expose Lenis instance for other components to read scroll position
		setLenisInstance(lenis);

		// Register with centralized RAF system for coordination with CoreScrollLine
		const rafHandle = registerRafTask((time) => {
			lenis.raf(time);
		});

		// Add lenis classes to html for CSS hooks
		document.documentElement.classList.add('lenis', 'lenis-smooth');

		return () => {
			document.documentElement.classList.remove('lenis', 'lenis-smooth');
			setLenisInstance(null);
			rafHandle.dispose();
			lenis.destroy();
		};
	});
</script>
