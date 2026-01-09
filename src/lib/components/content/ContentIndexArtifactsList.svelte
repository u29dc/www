<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
import ContentIndexArtifactsItem from '$lib/components/content/ContentIndexArtifactsItem.svelte';
import type { ParsedContent } from '$lib/content-types';
import type { MediaItem } from '$lib/mdx-client';

type ArtifactEntry = {
	item: ParsedContent;
	isConfidential: boolean;
	mediaItems: MediaItem[];
};

type Props = {
	items?: ArtifactEntry[];
	className?: string;
	startIndex?: number;
};

let { items = [], className = '', startIndex = 0 }: Props = $props();
</script>

<div class={`${className} overflow-visible`}>
	{#each items as entry, index (entry.item.frontmatter.slug)}
		<Animate stage="artifacts" index={startIndex + index} stagger={90}>
			<div
				class="-my-1 group relative cursor-pointer overflow-visible py-1 transition-opacity duration-200"
			>
				<div class="hidden hover-device:block group-hover:block">
					<div
						class="-right-2 md:-right-5 pointer-events-none absolute top-1/2 h-[1px] w-[4px] translate-y-[-50%] bg-current"
					></div>
				</div>
				<ContentIndexArtifactsItem
					item={entry.item}
					isConfidential={entry.isConfidential}
					mediaItems={entry.mediaItems}
				/>
			</div>
		</Animate>
	{/each}
</div>
