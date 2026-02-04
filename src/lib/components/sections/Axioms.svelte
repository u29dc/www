<script lang="ts">
	import { onMount } from "svelte";

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
	let prefersReducedMotion = $state(false);

	onMount(() => {
		prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (prefersReducedMotion) {
			visibleItems = new Set(axioms.map((_, i) => i));
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = items.indexOf(
							entry.target as HTMLElement,
						);
						if (index !== -1) {
							visibleItems = new Set([...visibleItems, index]);
						}
					}
				}
			},
			{ threshold: 0.2, rootMargin: "-50px" },
		);

		for (const item of items) {
			if (item) observer.observe(item);
		}

		return () => observer.disconnect();
	});
</script>

<section id="axioms" class="col-content py-44">
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 04 AXIOMS ]</h2>
	</header>

	<div class="flex flex-col">
		{#each axioms as axiom, index}
			<article
				bind:this={items[index]}
				class="group relative flex cursor-default gap-6 py-6 transition-all duration-500 [transition-timing-function:var(--ease-out)]"
				class:opacity-0={!visibleItems.has(index)}
				class:translate-y-5={!visibleItems.has(index)}
				class:opacity-100={visibleItems.has(index)}
				class:translate-y-0={visibleItems.has(index)}
				style:transition-delay={prefersReducedMotion
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
					<h3 class="font-serif font-lg bold">
						{axiom.title}
					</h3>
					<p class="mt-2 text-muted">{axiom.description}</p>
				</div>
			</article>
		{/each}
	</div>
</section>
