<script lang="ts">
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { CDN } from '$lib/constants';
import type { MediaItem } from '$lib/mdx-client';

interface AspectRatioPreset {
	className: string;
}

type Props = {
	mediaItems?: MediaItem[];
	slug: string;
	maxItems?: number;
	isHovered: boolean;
};

let { mediaItems = [], slug, maxItems = 4, isHovered }: Props = $props();

const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [{ className: 'aspect-[16/9] h-[4rem]' }, { className: 'aspect-[3/4] h-[6rem]' }, { className: 'aspect-[21/9] h-[5rem]' }];

const hashString = (input: string): number => {
	let hash = 5381;
	for (let i = 0; i < input.length; i += 1) {
		hash = (hash << 5) + hash + input.charCodeAt(i);
	}
	return hash >>> 0;
};

const selectPreset = (itemSlug: string, filename: string): AspectRatioPreset => {
	const hash = hashString(`${itemSlug}-${filename}`);
	const presetIndex = hash % ASPECT_RATIO_PRESETS.length;
	return ASPECT_RATIO_PRESETS[presetIndex] ?? ASPECT_RATIO_PRESETS[0];
};

const videoRefs = new Map<string, HTMLVideoElement>();

const registerVideo = (key: string) => (node: HTMLVideoElement) => {
	videoRefs.set(key, node);
	return {
		destroy() {
			videoRefs.delete(key);
		},
	};
};

const pauseAll = () => {
	for (const video of videoRefs.values()) {
		video.pause();
	}
};

const playAll = () => {
	for (const video of videoRefs.values()) {
		video.play().catch(() => {
			// autoplay may be blocked
		});
	}
};

const displayItems = $derived(maxItems > 0 ? mediaItems.slice(0, maxItems) : mediaItems);

$effect(() => {
	if (!browser) return;
	if (isHovered) {
		playAll();
	} else {
		pauseAll();
	}
});

onMount(() => {
	return () => {
		pauseAll();
		videoRefs.clear();
	};
});
</script>

{#if displayItems.length > 0}
	<div class={`flex gap-2 transition-all duration-300 ease-out ${isHovered ? 'opacity-100' : 'opacity-90 grayscale'}`}>
		{#each displayItems as mediaItem, index}
			{@const uniqueKey = `${mediaItem.filename}-${index}`}
			{@const preset = selectPreset(slug, mediaItem.filename)}
			{@const cdnUrl = `${CDN.mediaUrl}${mediaItem.filename}`}
            <div class={`shrink-0 ${preset.className}`}>
				{#if mediaItem.type === 'image'}
					<img class="media-fill" src={cdnUrl} alt={mediaItem.filename} loading="lazy" crossorigin="anonymous" referrerpolicy="origin" />
				{:else}
					<video
						use:registerVideo={uniqueKey}
						class="media-fill"
						src={cdnUrl}
						muted
						loop
						playsinline
						preload="metadata"
						crossorigin="anonymous"
						referrerpolicy="origin"
					></video>
				{/if}
			</div>
		{/each}
	</div>
{/if}
