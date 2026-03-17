<script lang="ts">
	import CoreSeoHead from "$lib/components/core/CoreSeoHead.svelte";
	import Hero from "$lib/components/sections/Hero.svelte";
	import Signal from "$lib/components/sections/Signal.svelte";
	import Protocols from "$lib/components/sections/Protocols.svelte";
	import Artifacts from "$lib/components/sections/Artifacts.svelte";
	import Origin from "$lib/components/sections/Origin.svelte";
	import Threshold from "$lib/components/sections/Threshold.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<CoreSeoHead seo={data.seo} />

<Hero />

<!-- Content wrapper: establishes stacking context above fixed hero -->
<div class="relative z-content grid-section-full">
	<Signal />
	<Protocols />
	<Artifacts artifacts={data.artifacts} />
	<Origin />
	<Threshold />
</div>
