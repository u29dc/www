<script lang="ts">
	import MdxMedia from "$lib/components/mdx/MdxMedia.svelte";
	import MdxMediaEnhancer from "$lib/components/mdx/MdxMediaEnhancer.svelte";
	import Threshold from "$lib/components/sections/Threshold.svelte";
	import { SITE } from "$lib/constants";
	import type { PageData } from "./$types";

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
			<h1 class="font-serif font-bold">{data.frontmatter.title}</h1>
			{#if data.frontmatter.description}
				<p class="mt-4 text-muted">{data.frontmatter.description}</p>
			{/if}
			<time class="mt-6 block font-mono opacity-50" datetime={data.frontmatter.date}>
				{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(data.frontmatter.date))}
			</time>
		</header>

		<div class="prose space-y-6">
			{@html data.contentHtml}
		</div>

		<p class="mt-16 font-handwritten text-muted">Han</p>

		<MdxMediaEnhancer />
	</div>
</article>

<Threshold />
