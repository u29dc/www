<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { createStaggerObserver } from "$lib/observe";

	interface Axiom {
		number: string;
		title: string;
		description: string;
	}

	const axioms: Axiom[] = [
		{
			number: "01",
			title: "The average is common, not correct.",
			description:
				"Best practices are floor, not ceiling. We optimize for distinctiveness.",
		},
		{
			number: "02",
			title: "Conviction over consensus.",
			description:
				"We take positions. Hedged recommendations help no one.",
		},
		{
			number: "03",
			title: "We work on what matters.",
			description:
				"Climate, infrastructure, deeptech, advanced materials. Problems worth solving.",
		},
	];

	let items: HTMLElement[] = $state([]);
	let visibleItems = $state(new Set<number>());

	onMount(() => {
		if (prefersReducedMotion.current) {
			visibleItems = new Set(axioms.map((_, i) => i));
			return;
		}

		const stagger = createStaggerObserver(
			items,
			(index) => {
				visibleItems = new Set([...visibleItems, index]);
			},
			{ threshold: 0.2, rootMargin: "-50px" },
		);

		return () => stagger.disconnect();
	});
</script>

<section id="axioms" class="col-content py-44">
	<header class="mb-16">
		<p class="font-mono text-muted">[ 04 AXIOMS ]</p>
	</header>

	<div class="flex flex-col">
		{#each axioms as axiom, index}
			<article
				bind:this={items[index]}
				class="group relative flex cursor-default gap-6 py-6 transition-all duration-500 [transition-timing-function:var(--ease-settle)]"
				class:opacity-0={!visibleItems.has(index)}
				class:translate-y-5={!visibleItems.has(index)}
				class:opacity-100={visibleItems.has(index)}
				class:translate-y-0={visibleItems.has(index)}
				style:transition-delay={prefersReducedMotion.current
					? "0ms"
					: `${index * 100}ms`}
			>
				<div
					class="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-transparent transition-colors duration-200 group-hover:bg-current/40"
					aria-hidden="true"
				></div>

				<span class="font-mono text-muted shrink-0 pl-4"
					>{axiom.number}</span
				>
				<div>
					<h2 class="font-serif font-lg font-bold">
						{axiom.title}
					</h2>
					<p class="mt-2 text-muted">{axiom.description}</p>
				</div>
			</article>
		{/each}
	</div>
</section>
