<script lang="ts">
	import "../app.css";
	import type { Snippet } from "svelte";
	import AtomicGradientBlur from "$lib/components/atomic/AtomicGradientBlur.svelte";
	import CoreGrainOverlay from "$lib/components/core/CoreGrainOverlay.svelte";
	import CoreHeader from "$lib/components/core/CoreHeader.svelte";
	import CorePageTransition from "$lib/components/core/CorePageTransition.svelte";
	import CoreScrollLine from "$lib/components/core/CoreScrollLine.svelte";
	import CoreSmoothScroll from "$lib/components/core/CoreSmoothScroll.svelte";
	import CoreViewportFix from "$lib/components/core/CoreViewportFix.svelte";
	import { CDN, SITE } from "$lib/constants";
	import type { LayoutData } from "./$types";

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content={SITE.themeColor} />
	<meta name="color-scheme" content="light dark" />
	<link rel="preconnect" href={CDN.baseUrl} crossorigin="anonymous" />
	<!-- Critical font preloads for LCP -->
	<link
		rel="preload"
		href="/fonts/acumin-pro-600-normal.woff2"
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
	class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:ring-2 focus:ring-ink"
>
	Skip to main content
</a>

<CoreViewportFix />
<CoreSmoothScroll />

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
