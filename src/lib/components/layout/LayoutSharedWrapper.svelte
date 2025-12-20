<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { setTimeline, TIMELINE_ARTICLE, TIMELINE_INDEX } from '$lib/animation';
import Animate from '$lib/components/animation/Animate.svelte';
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

const timeline = type === 'index' ? TIMELINE_INDEX : TIMELINE_ARTICLE;
setTimeline(timeline);

let renderKey = $state(0);

onMount(() => {
	renderKey += 1;
});
</script>

{#key renderKey}
	<main class="full-container relative isolate min-h-screen overflow-x-hidden">
		<section data-section="header" class="relative z-10 w-full">
			<Animate stage="header">
				<LayoutSharedHeader type={type} frontmatter={frontmatter} />
			</Animate>
		</section>

		<section data-section="content" class="relative w-full">
			{@render children()}
		</section>

		<section data-section="footer" class="relative z-40 w-full">
			<Animate stage="footer">
				<LayoutSharedFooter />
			</Animate>
		</section>

		<CoreScrollOverlay pageType={type} />
	</main>
{/key}
