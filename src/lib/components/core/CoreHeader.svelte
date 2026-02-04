<script lang="ts">
	import AtomicBrandLogo from '$lib/components/atomic/AtomicBrandLogo.svelte';

	const sections = [
		{ id: 'signal', label: '01 Signal' },
		{ id: 'protocols', label: '02 Protocols' },
		{ id: 'artifacts', label: '03 Artifacts' },
		{ id: 'axioms', label: '04 Axioms' },
		{ id: 'founder', label: '05 Founder' },
	];
</script>

<header class="fixed top-4 left-1/2 z-50 -translate-x-1/2">
	<nav
		aria-label="Main navigation"
		class="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur-xl"
	>
		<!-- Logo -->
		<a href="/" class="flex items-center -my-3" aria-label="Go to homepage">
			<AtomicBrandLogo width={140} noiseIntensity={0.1} />
		</a>

		<!-- Divider -->
		<div class="h-5 w-px bg-black/10" aria-hidden="true"></div>

		<!-- Section links -->
		<ul class="flex items-center gap-1">
			{#each sections as section}
				<li>
					<a
						href="#{section.id}"
						class="rounded-md px-3 py-2 font-mono text-sm text-black/60 transition-colors hover:bg-black/5 hover:text-black"
					>
						{section.label}
					</a>
				</li>
			{/each}
		</ul>

		<!-- Divider -->
		<div class="h-5 w-px bg-black/10" aria-hidden="true"></div>

		<!-- CTA -->
		<a
			href="https://cal.com/u29dc"
			class="rounded-md bg-black px-3 py-2 font-mono text-sm text-white transition-colors hover:bg-black/80"
		>
			Book a call
		</a>
	</nav>
</header>
