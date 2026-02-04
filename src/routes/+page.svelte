<script lang="ts">
	import { SITE } from "$lib/constants";
	import Hero from "$lib/components/sections/Hero.svelte";
	import Signal from "$lib/components/sections/Signal.svelte";
	import Protocols from "$lib/components/sections/Protocols.svelte";
	import Artifacts from "$lib/components/sections/Artifacts.svelte";
	import Axioms from "$lib/components/sections/Axioms.svelte";
	import Founder from "$lib/components/sections/Founder.svelte";
	import Threshold from "$lib/components/sections/Threshold.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{SITE.title}</title>
	<meta name="description" content={SITE.description} />
</svelte:head>

<Hero />

<!-- Content wrapper: establishes stacking context above fixed hero -->
<div class="relative z-10 grid-section-full">
	<Signal />
	<Protocols />
	<Artifacts artifacts={data.artifacts} />
	<Axioms />
	<Founder />
	<Threshold />
</div>
