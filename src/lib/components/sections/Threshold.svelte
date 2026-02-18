<script lang="ts">
	import { onMount } from "svelte";
	import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
	import AtomicBrandLogo from "$lib/components/atomic/AtomicBrandLogo.svelte";

	type Props = {
		compact?: boolean;
	};

	let { compact = false }: Props = $props();

	let isMobile = $state(false);

	onMount(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	});

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
			href: "https://cal.com/u29dc/hey",
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
	class="grid-section-full min-h-screen-safe bg-black/5 -mx-[var(--grid-margin)] px-[var(--grid-margin)] md:-mx-[var(--grid-margin-md)] md:px-[var(--grid-margin-md)] lg:mx-0 lg:px-0 rounded-sm"
	class:mt-96={!compact}
	class:mt-40={compact}
>
	<div
		class="col-content flex flex-col justify-between gap-16 pb-16"
		class:pt-64={!compact}
		class:pt-40={compact}
	>
		<!-- Top: Headline + Pricing + Grid Links -->
		<div class="w-full mt-4">
			<h2 class="font-serif font-2xl font-bold">
				<span class="block sm:inline"
					>Stories that hold aren't written.</span
				>
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
						class="group -mx-3 flex flex-row justify-between gap-2 border-b border-black/10 px-3 py-6 transition duration-200 hover:bg-black hover:text-white focus-ring external-link-feedback"
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
							<ArrowUpRight size={16} />
						</div>
					</a>
				{/each}
			</div>
		</div>

		<!-- Middle: Large Logo -->
		<AtomicBrandLogo
			width={isMobile ? 250 : 400}
			theme="light"
			noiseIntensity={0.1}
			noiseScale={0.5}
			defaultBlurIntensity={0.25}
			blurStart={1.5}
			mouseBlurIntensity={isMobile ? 0.2 : 0.25}
			mouseBlurSize={isMobile ? 0.2 : 0.4}
		/>

		<!-- Bottom: Handwritten Signature -->
		<div class="relative -top-20 font-handwritten sm:-top-24">
			After all, isn't true infinity always incomplete?
		</div>
	</div>
</footer>
