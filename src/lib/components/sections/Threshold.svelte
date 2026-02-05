<script lang="ts">
	import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
	import AtomicBrandLogo from "$lib/components/atomic/AtomicBrandLogo.svelte";

	interface FooterLink {
		title: string;
		description: string;
		href: string;
		note?: string;
	}

	const links: FooterLink[] = [
		{
			title: "Calendar",
			description: "Let's meet",
			href: "https://u29dc.co/hey",
			note: "Always open to conversations that question premises, not just solve within them",
		},
		{
			title: "Email",
			description: "han@u29dc.com",
			href: "mailto:han@u29dc.com",
			note: "Response time: 48 hours",
		},
		{
			title: "Instagram",
			description: "@u29dc",
			href: "https://instagram.com/u29dc",
		},
		{
			title: "LinkedIn",
			description: "u29dc",
			href: "https://linkedin.com/in/u29dc",
		},
	];
</script>

<footer
	id="threshold"
	class="mt-96 grid-section-full min-h-screen-safe bg-black/5 -mx-[var(--grid-margin)] px-[var(--grid-margin)] md:-mx-[var(--grid-margin-md)] md:px-[var(--grid-margin-md)] lg:mx-0 lg:px-0"
>
	<div class="col-content flex flex-col justify-between gap-16 pb-16 pt-64">
		<!-- Top: Headline + Pricing + Grid Links -->
		<div class="w-full">
			<h2 class="font-serif font-2xl bold">
				<span class="block sm:inline">Stories that hold aren't written.</span>
				<span class="block sm:inline">They're built.</span>
			</h2>

			<p class="mt-8 font-mono text-muted">
				£3,000 · 48 hours · Three routes, one recommendation.
			</p>

			<!-- Grid Links (2 columns) -->
			<div class="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
				{#each links as link}
					<a
						href={link.href}
						target={link.href.startsWith("mailto:")
							? undefined
							: "_blank"}
						rel={link.href.startsWith("mailto:")
							? undefined
							: "noopener noreferrer"}
						class="group -mx-3 flex flex-row justify-between gap-2 border-b border-black/10 px-3 py-6 transition duration-200 hover:bg-black hover:text-white focus-ring"
					>
						<div>
							<div class="uppercase">{link.title}</div>
							<div class="text-muted group-hover:text-white/60">
								{link.description}
							</div>
							{#if link.note}
								<div
									class="mt-2 font-mono text-muted group-hover:text-white/60"
								>
									[ {link.note} ]
								</div>
							{/if}
						</div>
						<div
							class="transition-all duration-200 group-hover:mr-2"
						>
							<ArrowUpRight size={12} />
						</div>
					</a>
				{/each}
			</div>
		</div>

		<!-- Middle: Large Logo -->
		<AtomicBrandLogo
			className="-translate-x-[375px]"
			width={1000}
			defaultBlurIntensity={0.25}
			mouseBlurIntensity={0.4}
			noiseIntensity={0.1}
			noiseScale={0.5}
			theme="light"
		/>

		<!-- Bottom: Handwritten Signature -->
		<div class="relative -top-20 font-handwritten sm:-top-24">
			After all, isn't true infinity always incomplete?
		</div>
	</div>
</footer>
