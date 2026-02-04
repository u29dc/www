<script lang="ts">
	interface Artifact {
		slug: string;
		title: string;
		description: string;
		type: string;
		isConfidential: boolean;
	}

	let { artifacts }: { artifacts: Artifact[] } = $props();
</script>

<section id="artifacts" class="col-content py-32">
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 03 ARTIFACTS ]</h2>
	</header>

	<div class="[&>article+article]:border-t [&>article+article]:border-current/10">
		{#each artifacts as artifact}
			<article class="py-8">
				<span class="font-mono text-muted">{artifact.type}</span>
				{#if artifact.isConfidential}
					<h3 class="font-lg font-medium mt-2 text-muted">{artifact.title}</h3>
					<p class="mt-2 text-muted/50">Confidential</p>
				{:else}
					<a href="/{artifact.slug}" class="block group">
						<h3 class="font-lg font-medium mt-2 group-hover:underline">{artifact.title}</h3>
						<p class="mt-2 text-muted">{artifact.description}</p>
					</a>
				{/if}
			</article>
		{/each}
	</div>
</section>
