<script lang="ts">
	import MdxMedia from '$lib/components/mdx/MdxMedia.svelte';
	import MdxMediaEnhancer from '$lib/components/mdx/MdxMediaEnhancer.svelte';
	import { SITE } from '$lib/constants';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{SITE.name} | {data.frontmatter.title}</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<article class="grid-section-full py-32">
	{#if data.firstMedia}
		<div class="col-wide mb-16">
			<MdxMedia src={data.firstMedia} />
		</div>
	{/if}

	<div class="col-content">
		<header class="mb-16">
			<h1>{data.frontmatter.title}</h1>
			{#if data.frontmatter.description}
				<p class="mt-4 text-muted">{data.frontmatter.description}</p>
			{/if}
		</header>

		<div class="prose space-y-6">
			{@html data.contentHtml}
		</div>

		<MdxMediaEnhancer />
	</div>
</article>
