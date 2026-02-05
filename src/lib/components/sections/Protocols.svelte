<script lang="ts">
	import { ArrowRight, Lock } from "@lucide/svelte";

	interface Protocol {
		title: string;
		subtitle: string;
		price: string;
		timeline: string;
		description: string;
		cta: string;
		emphasized?: boolean;
		requires?: string;
	}

	const protocols: Protocol[] = [
		{
			title: "MAP",
			subtitle: "Diagnose",
			price: "£3,000",
			timeline: "48 hours",
			description:
				"Strategic diagnosis within 48 hours. We audit your existing narrative, identify where coherence breaks down, and deliver three actionable routes forward.",
			cta: "Start here",
			emphasized: true,
		},
		{
			title: "ARC",
			subtitle: "Architect",
			price: "£25,000–60,000",
			timeline: "4–6 weeks",
			description:
				"Full narrative package. Origin story, positioning framework, voice system, and a flagship artifact your team can scale from.",
			cta: "Requires MAP",
			requires: "MAP",
		},
		{
			title: "ADV",
			subtitle: "Steward",
			price: "£8,000–15,000",
			timeline: "per month · 3-month minimum",
			description:
				"Ongoing creative direction. Strategic counsel, artifact development, and narrative coherence as you scale.",
			cta: "Requires ARC",
			requires: "ARC",
		},
	];
</script>

<section id="protocols" class="col-content-wide py-44 content-visibility-auto">
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 02 PROTOCOLS ]</h2>
	</header>

	<div class="grid gap-4 md:grid-cols-3">
		{#each protocols as protocol}
			<article
				class="flex min-h-[300px] flex-col rounded-lg p-8 md:min-h-[420px] {protocol.emphasized
					? 'bg-black text-white'
					: 'bg-black/5'}"
			>
				<!-- Header -->
				<div>
					<p
						class="font-mono text-xs {protocol.emphasized
							? 'text-white/50'
							: 'text-muted'}"
					>
						{protocol.subtitle}
					</p>
					<h3 class="font-subtitle mt-2">{protocol.title}</h3>
				</div>

				<!-- Price -->
				<div class="mt-8">
					<p class="font-serif font-lg font-bold mb-4">
						{protocol.price}
					</p>
					<p
						class="font-mono mt-1 {protocol.emphasized
							? 'text-white/50'
							: 'text-muted'}"
					>
						{protocol.timeline}
					</p>
				</div>

				<!-- Description -->
				<p
					class="mt-8 flex-1 leading-relaxed {protocol.emphasized
						? 'text-white/70'
						: 'text-muted'}"
				>
					{protocol.description}
				</p>

				<!-- CTA -->
				{#if protocol.requires}
					<button
						type="button"
						disabled
						class="mt-8 flex w-full items-center justify-between rounded-md px-4 py-3 font-medium bg-black/5 text-muted/60 cursor-not-allowed"
					>
						<span>{protocol.cta}</span>
						<Lock size={16} aria-hidden="true" />
					</button>
				{:else}
					<a
						href="https://cal.com/u29dc"
						class="mt-8 flex w-full items-center justify-between rounded-md px-4 py-3 font-medium transition-colors focus-ring {protocol.emphasized
							? 'bg-white text-black hover:bg-white/90'
							: 'bg-black/10 hover:bg-black/15'}"
					>
						<span>{protocol.cta}</span>
						<ArrowRight size={16} aria-hidden="true" />
					</a>
				{/if}
			</article>
		{/each}
	</div>
</section>
