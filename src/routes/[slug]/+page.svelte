<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
import LayoutSharedWrapper from '$lib/components/layout/LayoutSharedWrapper.svelte';
import MdxMediaEnhancer from '$lib/components/mdx/MdxMediaEnhancer.svelte';
import { SITE } from '$lib/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
const contentHtml = $derived(data.contentHtml);
</script>

<svelte:head>
	<title>{SITE.name} | {data.frontmatter.title}</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<LayoutSharedWrapper type="article" frontmatter={data.frontmatter}>
	<Animate stage="article">
		<div>{@html contentHtml}</div>
	</Animate>
	<MdxMediaEnhancer />
</LayoutSharedWrapper>
