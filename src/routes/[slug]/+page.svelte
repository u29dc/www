<script lang="ts">
	import MdxMediaEnhancer from '$lib/components/mdx/MdxMediaEnhancer.svelte';
	import { SITE } from '$lib/constants';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{SITE.name} | {data.frontmatter.title}</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<article class="padding-standard">
	<header class="mb-8">
		<h1>{data.frontmatter.title}</h1>
		{#if data.frontmatter.description}
			<p class="mt-2 text-muted">{data.frontmatter.description}</p>
		{/if}
	</header>

	<div class="content">
		{@html data.contentHtml}
	</div>

	<MdxMediaEnhancer />
</article>
