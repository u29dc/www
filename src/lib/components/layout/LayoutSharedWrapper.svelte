<script lang="ts">
import type { Snippet } from 'svelte';
import CoreScrollOverlay from '$lib/components/core/CoreScrollOverlay.svelte';
import LayoutSharedFooter from '$lib/components/layout/LayoutSharedFooter.svelte';
import LayoutSharedHeader from '$lib/components/layout/LayoutSharedHeader.svelte';
import type { ContentItem } from '$lib/content-types';

type Props = {
	type: 'index' | 'article';
	frontmatter?: ContentItem;
	children: Snippet;
};

let { type, frontmatter, children }: Props = $props();
</script>

<main class="full-container relative isolate min-h-screen overflow-x-hidden">
	<section data-section="header" class="relative z-10 w-full">
		<LayoutSharedHeader type={type} frontmatter={frontmatter} />
	</section>

	<section data-section="content" class="relative w-full">
		{@render children()}
	</section>

	<section data-section="footer" class="relative z-40 w-full">
		<LayoutSharedFooter />
	</section>

	<CoreScrollOverlay pageType={type} />
</main>
