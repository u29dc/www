<script lang="ts">
	import { onMount } from "svelte";
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

	let activeSection = $state<string | null>(null);

	onMount(() => {
		if (isSlugPage) return;

		const sectionElements = sections
			.map(({ id }) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				}
			},
			{ threshold: 0.3, rootMargin: "-100px 0px -50% 0px" },
		);

		for (const el of sectionElements) {
			observer.observe(el);
		}

		return () => observer.disconnect();
	});
</script>

<header class="fixed top-4 left-0 right-0 z-50 grid-page">
	<nav
		aria-label="Main navigation"
		class="col-content flex w-fit select-none items-center gap-2 rounded-lg bg-white/80 p-[5px] shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300"
	>
		{#if isSlugPage}
			<!-- Back button -->
			<AtomicHeaderButton href="/" class="inline-flex items-center gap-2">
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
			<div class="relative min-h-[30px] w-[80px]">
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
					aria-current={activeSection === section.id
						? "true"
						: undefined}
				>
					{section.num}
					{section.name}
				</AtomicHeaderButton>
			{/each}
		{/if}
	</nav>
</header>
