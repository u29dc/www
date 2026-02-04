<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft } from '@lucide/svelte';
	import AtomicBrandLogo from '$lib/components/atomic/AtomicBrandLogo.svelte';

	const sections = [
		{ id: 'signal', num: '01', name: 'Signal' },
		{ id: 'protocols', num: '02', name: 'Protocols' },
		{ id: 'artifacts', num: '03', name: 'Artifacts' },
		{ id: 'axioms', num: '04', name: 'Axioms' },
		{ id: 'founder', num: '05', name: 'Founder' },
	];

	const isSlugPage = $derived(page.route.id === '/[slug]');
	const articleTitle = $derived((page.data?.['frontmatter'] as { title?: string } | undefined)?.title);
</script>

<header class="fixed top-4 left-0 right-0 z-50 grid-page">
	<nav
		aria-label="Main navigation"
		class="col-content flex w-fit items-center gap-2 rounded-lg bg-white/80 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300"
	>
		{#if isSlugPage}
			<!-- Back button -->
			<a
				href="/"
				class="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm text-black/60 transition-colors hover:bg-black/5 hover:text-black"
				aria-label="Back to homepage"
			>
				<ArrowLeft size={14} />
				Back
			</a>

			<!-- Divider -->
			<div class="h-5 w-px bg-black/10" aria-hidden="true"></div>

			<!-- Article title -->
			{#if articleTitle}
				<span class="font-mono text-sm text-black/60 uppercase">
					{articleTitle}
				</span>
			{/if}
		{:else}
			<!-- Logo -->
			<a href="/" class="flex items-center -my-3" aria-label="Go to homepage">
				<AtomicBrandLogo width={140} noiseIntensity={0.1} />
			</a>

			<!-- Divider -->
			<div class="hidden h-5 w-px bg-black/10 sm:block" aria-hidden="true"></div>

			<!-- Section links -->
			<ul class="hidden items-center gap-1 sm:flex">
				{#each sections as section}
					<li>
						<a
							href="#{section.id}"
							class="rounded-md px-3 py-2 font-mono text-sm text-black/60 transition-colors hover:bg-black/5 hover:text-black"
						>
							{section.num} {section.name}
						</a>
					</li>
				{/each}
			</ul>

			<!-- Divider -->
			<div class="hidden h-5 w-px bg-black/10 sm:block" aria-hidden="true"></div>

			<!-- CTA -->
			<a
				href="https://cal.com/u29dc"
				class="hidden whitespace-nowrap rounded-md bg-black px-4 py-2 font-mono text-sm text-white transition-colors hover:bg-black/80 sm:block"
			>
				Book a call
			</a>
		{/if}
	</nav>
</header>
