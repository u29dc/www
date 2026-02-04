<script lang="ts">
	import "../app.css";
	import type { Snippet } from "svelte";
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
	<link rel="preconnect" href="https://use.typekit.net" crossorigin="anonymous" />
	<link rel="stylesheet" href="https://use.typekit.net/dim0jav.css" />
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

<CoreViewportFix />
<CoreSmoothScroll />

<CorePageTransition>
	<CoreHeader />
	<CoreScrollLine />
	<CoreGrainOverlay
		intensity={0.5}
		grainScale={10.0}
		animationSpeed={0.1}
		exposure={0.01}
	/>

	<main class="grid-page">
		{@render children()}
	</main>
</CorePageTransition>
