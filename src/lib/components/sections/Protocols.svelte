<script lang="ts">
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import Lock from "@lucide/svelte/icons/lock";

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

<section id="protocols" class="grid-section-full py-44">
	<header class="col-content mb-16">
		<p class="font-mono text-muted">[ 01 PROTOCOLS ]</p>
	</header>

	<div
		class="col-content-wide w-full [content-visibility:auto] [contain-intrinsic-size:1000px_800px]"
	>
		<div class="flex flex-col gap-4 xl:flex-row xl:items-stretch">
				{#each protocols as protocol}
					<article
						class="flex min-h-[300px] min-w-0 flex-col rounded-sm p-8 xl:min-h-[420px] xl:basis-0 xl:flex-1 {protocol.emphasized
							? 'bg-contrast'
							: 'bg-subtle'}"
					>
					<!-- Header -->
					<div>
							<p
								class="font-mono text-xs {protocol.emphasized
									? 'opacity-60'
									: 'text-muted'}"
							>
							{protocol.subtitle}
						</p>
						<h2 class="font-subtitle mt-2">{protocol.title}</h2>
					</div>

					<!-- Price -->
					<div class="mt-8">
						<p class="font-serif font-lg font-bold mb-4">
							{protocol.price}
						</p>
							<p
								class="font-mono mt-1 {protocol.emphasized
									? 'opacity-60'
									: 'text-muted'}"
							>
							{protocol.timeline}
						</p>
					</div>

					<!-- Description -->
						<p
							class="mt-8 flex-1 leading-relaxed {protocol.emphasized
								? 'opacity-75'
								: 'text-muted'}"
						>
						{protocol.description}
					</p>

					<!-- CTA -->
						{#if protocol.requires}
							<button
								type="button"
								disabled
								class="mt-8 flex w-full cursor-not-allowed items-center justify-between rounded-md bg-subtle px-4 py-3 font-medium text-muted/60"
							>
							<span>{protocol.cta}</span>
							<Lock size={16} aria-hidden="true" />
						</button>
					{:else}
							<a
								href="https://cal.com/u29dc/map"
								class="mt-8 flex w-full items-center justify-between rounded-md px-4 py-3 font-medium transition-colors focus-ring external-link-feedback {protocol.emphasized
									? 'bg-contrast hover-opacity-soft'
									: 'bg-subtle hover-bg-subtle'}"
							>
							<span>{protocol.cta}</span>
							<ArrowRight size={16} aria-hidden="true" />
						</a>
					{/if}
				</article>
			{/each}
		</div>
	</div>
</section>
