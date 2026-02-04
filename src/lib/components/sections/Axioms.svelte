<script lang="ts">
	interface Axiom {
		number: string;
		title: string;
		description: string;
	}

	const axioms: Axiom[] = [
		{
			number: '01',
			title: 'The average is common, not correct.',
			description: 'Best practices are floor, not ceiling. We optimize for distinctiveness.',
		},
		{
			number: '02',
			title: 'Conviction over consensus.',
			description: 'We take positions. Hedged recommendations help no one.',
		},
		{
			number: '03',
			title: 'We inhabit the voids.',
			description: 'The interesting work lives between disciplines. We span them.',
		},
		{
			number: '04',
			title: 'Profit is the point.',
			description: "Beautiful work that doesn't drive business isn't strategy.",
		},
		{
			number: '05',
			title: 'Specificity is the strategy.',
			description: 'Generic positioning serves no one. We find the sharp edge.',
		},
		{
			number: '06',
			title: 'We work on what matters.',
			description: 'Climate, infrastructure, advanced materials. Problems worth solving.',
		},
	];
</script>

<section id="axioms" class="col-content py-32">
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 04 AXIOMS ]</h2>
	</header>

	<div class="flex flex-col gap-8">
		{#each axioms as axiom}
			<article class="flex gap-4">
				<span class="font-mono text-muted shrink-0">{axiom.number}</span>
				<div>
					<h3 class="font-md font-semibold">{axiom.title}</h3>
					<p class="mt-2 text-muted">{axiom.description}</p>
				</div>
			</article>
		{/each}
	</div>
</section>
