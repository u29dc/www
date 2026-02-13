<script lang="ts">
	import "../app.css";
	import type { Snippet } from "svelte";
	import { onMount } from "svelte";
	import AtomicGradientBlur from "$lib/components/atomic/AtomicGradientBlur.svelte";
	import CoreGrainOverlay from "$lib/components/core/CoreGrainOverlay.svelte";
	import CoreHeader from "$lib/components/core/CoreHeader.svelte";
	import CoreLoader from "$lib/components/core/CoreLoader.svelte";
	import CorePageTransition from "$lib/components/core/CorePageTransition.svelte";
	import CoreScrollLine from "$lib/components/core/CoreScrollLine.svelte";
	import CoreScrollProgress from "$lib/components/core/CoreScrollProgress.svelte";
	import CoreSmoothScroll from "$lib/components/core/CoreSmoothScroll.svelte";
	import CoreViewportFix from "$lib/components/core/CoreViewportFix.svelte";
	import { CDN, SITE } from "$lib/constants";
	import { loader } from "$lib/loader.svelte";
	import { resetScroll, startScroll, stopScroll } from "$lib/scroll";
	import type { LayoutData } from "./$types";

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// Loader timing orchestration
	// onMount only fires on fresh loads (layout mounts once per session)
	onMount(() => {
		// Disable browser's automatic scroll restoration on refresh
		// Must happen before any scroll operations
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}

		// Reset scroll immediately on page load (before Lenis initializes)
		// This handles browser scroll restoration that happens before JS
		window.scrollTo(0, 0);

		// Skip if loader already completed (defensive)
		if (loader.hasCompleted) return;

		// Block scrolling while loader is active (Lenis + native CSS fallback)
		stopScroll();
		document.documentElement.classList.add("loader-active");

		// When loader completes: reset scroll to top and resume scrolling
		loader.onComplete(() => {
			resetScroll();
			startScroll();
			document.documentElement.classList.remove("loader-active");
		});

		// Hold loader for 2.5s progress + 0.5s breathing space after progress completes
		const holdDuration = 3000;

		const timer = setTimeout(() => {
			loader.complete();
		}, holdDuration);

		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<meta name="theme-color" content={SITE.themeColor} />
	<meta name="color-scheme" content="light dark" />
	<link rel="preconnect" href={CDN.baseUrl} crossorigin="anonymous" />
	<!-- Critical font preloads for LCP -->
	<link
		rel="preload"
		href="/fonts/geist-variable-normal.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/meno-display-700-italic.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/fira-code-variable-normal.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link rel="manifest" href="/manifest.json" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon" />
	<link rel="icon" href="/icon-16.png" sizes="16x16" type="image/png" />
	<link rel="icon" href="/icon-32.png" sizes="32x32" type="image/png" />
	<link rel="icon" href="/icon-96.png" sizes="96x96" type="image/png" />
	<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link
		rel="mask-icon"
		href="/safari-pinned-tab.svg"
		color={SITE.themeColor}
	/>
	{#if data?.nonce}
		<meta property="csp-nonce" content={data.nonce} />
		<script src="/empty.js" nonce={data.nonce} defer></script>
	{/if}
</svelte:head>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-chrome focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:ring-2 focus:ring-ink"
>
	Skip to main content
</a>

<CoreViewportFix />
<CoreSmoothScroll />

<!-- Initial page loader (above everything) -->
<CoreLoader />

<CorePageTransition>
	<AtomicGradientBlur
		position="top"
		size="12rem"
		fixed={true}
		layers={5}
		zIndex={40}
	/>
	<AtomicGradientBlur
		position="bottom"
		size="10rem"
		fixed={true}
		zIndex={40}
	/>
	<CoreHeader />
	<CoreScrollLine />
	<CoreScrollProgress />
	<CoreGrainOverlay
		intensity={0.5}
		grainScale={10.0}
		animationSpeed={0.1}
		exposure={0.01}
	/>

	<main id="main-content" tabindex="-1" class="grid-page">
		{@render children()}
	</main>
</CorePageTransition>
