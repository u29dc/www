<script lang="ts">
	import { page } from "$app/state";
	import { ArrowLeft } from "@lucide/svelte";
	import AtomicBrandLogo from "$lib/components/atomic/AtomicBrandLogo.svelte";
	import AtomicHeaderButton from "$lib/components/atomic/AtomicHeaderButton.svelte";

	const sections = [
		{ id: "signal", num: "01", name: "Signal" },
		{ id: "protocols", num: "02", name: "Protocols" },
		{ id: "artifacts", num: "03", name: "Artifacts" },
		{ id: "axioms", num: "04", name: "Axioms" },
		{ id: "founder", num: "05", name: "Founder" },
	];

	const isSlugPage = $derived(page.route.id === "/[slug]");
	const articleTitle = $derived(
		(page.data?.["frontmatter"] as { title?: string } | undefined)?.title,
	);
</script>

<header class="fixed top-4 left-0 right-0 z-50 grid-page">
	<nav
		aria-label="Main navigation"
		class="col-content flex w-fit select-none items-center gap-2 rounded-lg bg-white/80 p-[5px] shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300"
	>
		{#if isSlugPage}
			<!-- Back button -->
			<AtomicHeaderButton href="/" class="flex items-center gap-2">
				<ArrowLeft size={14} />
				Back
			</AtomicHeaderButton>

			<!-- Divider -->
			<div class="h-4 w-px bg-black/10" aria-hidden="true"></div>

			<!-- Article title -->
			{#if articleTitle}
				<span class="font-mono text-[9px] text-black/60 uppercase">
					{articleTitle}
				</span>
			{/if}
		{:else}
			<!-- Logo -->
			<div class="relative min-h-[30px] w-[80px] rounded-md bg-black/5">
				<div
					class="absolute top-1/2 left-1/2 w-0 -translate-x-1/2 -translate-y-1/2 overflow-visible"
				>
					<AtomicBrandLogo
						width={180}
						noiseIntensity={0.1}
						className="-translate-x-1/2"
					/>
				</div>
			</div>

			<!-- Divider -->
			<div
				class="hidden h-4 w-px bg-black/10 sm:block"
				aria-hidden="true"
			></div>

			<!-- Section links -->
			{#each sections as section}
				<AtomicHeaderButton
					href="#{section.id}"
					class="hidden sm:inline-flex"
				>
					{section.num}
					{section.name}
				</AtomicHeaderButton>
			{/each}
		{/if}
	</nav>
</header>
