<script lang="ts">
import ContentIndexArtifactsList from '$lib/components/content/ContentIndexArtifactsList.svelte';
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
};

let { items = [] }: Props = $props();
</script>

<div class="my-10">
	<div class="flex w-full justify-end">
		<div class="mb-10 text-right font-mono">
			the territory between disciplines holds questions specialists cannot ask alone
		</div>
	</div>

	<ContentIndexArtifactsList items={items} />
</div>
