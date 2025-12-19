<script lang="ts">
import ContentIndexArtifactsItem from '$lib/components/content/ContentIndexArtifactsItem.svelte';
import type { ParsedContent } from '$lib/content-types';
import type { MediaItem } from '$lib/mdx-client';

type ArtifactEntry = {
	item: ParsedContent;
	isConfidential: boolean;
	thumbnailUrl: string | null;
	mediaItems: MediaItem[];
};

type Props = {
	items?: ArtifactEntry[];
	className?: string;
};

let { items = [], className = '' }: Props = $props();
</script>

<div class={`${className} overflow-visible`}>
	{#each items as entry (entry.item.frontmatter.slug)}
		<div class="-my-1 group relative cursor-pointer overflow-visible py-1 transition-opacity duration-200">
			<div class="hidden hover-device:block group-hover:block">
				<div class="-right-2 md:-right-5 pointer-events-none absolute top-1/2 h-[1px] w-[4px] translate-y-[-50%] bg-current"></div>
			</div>
			<ContentIndexArtifactsItem
				item={entry.item}
				isConfidential={entry.isConfidential}
				thumbnailUrl={entry.thumbnailUrl}
				mediaItems={entry.mediaItems}
			/>
		</div>
	{/each}
</div>
