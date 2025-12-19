<script lang="ts">
import type { SvelteComponent } from 'svelte';
import LayoutSharedWrapper from '$lib/components/layout/LayoutSharedWrapper.svelte';
import { SITE } from '$lib/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const modules = import.meta.glob('/src/content/*.mdx', { eager: true });
const module = $derived(modules[`/src/content/${data.slug}.mdx`] as { default?: typeof SvelteComponent } | undefined);
const Content = $derived(module?.default);
</script>

<svelte:head>
	<title>{SITE.name} | {data.frontmatter.title}</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<LayoutSharedWrapper type="article" frontmatter={data.frontmatter}>
	{#if Content}
		<Content />
	{/if}
</LayoutSharedWrapper>
