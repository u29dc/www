<script lang="ts">
import { getContext, onMount } from 'svelte';
import { MEDIA_LAYOUT_CONTEXT, type MediaLayoutContextValue } from '$lib/components/mdx/mdx-context';
import { CDN } from '$lib/constants';

type Props = {
	src: string;
	alt?: string;
};

let { src, alt = '' }: Props = $props();

const context = getContext<MediaLayoutContextValue>(MEDIA_LAYOUT_CONTEXT);
const id = $state(Math.random().toString(36).slice(2));
const fullUrl = $derived(`${CDN.mediaUrl}${src}`);
const isVideo = $derived(src.toLowerCase().includes('.webm') || src.toLowerCase().includes('.mp4'));

let imageRef = $state<HTMLImageElement | null>(null);
let videoRef = $state<HTMLVideoElement | null>(null);

const register = (aspectRatio: number) => {
	if (context && Number.isFinite(aspectRatio) && aspectRatio > 0) {
		context.registerItem(id, aspectRatio);
	}
};

const handleImageLoad = () => {
	if (!imageRef) return;
	const aspectRatio = imageRef.naturalWidth / imageRef.naturalHeight;
	register(aspectRatio);
};

const handleVideoMetadata = () => {
	if (!videoRef) return;
	const aspectRatio = videoRef.videoWidth / videoRef.videoHeight;
	register(aspectRatio);
};

onMount(() => {
	const element = isVideo ? videoRef : imageRef;
	if (!element) return;

	if (isVideo) {
		const video = element as HTMLVideoElement;
		if (video.readyState >= 1 && video.videoWidth > 0) {
			register(video.videoWidth / video.videoHeight);
		}
		return;
	}

	const img = element as HTMLImageElement;
	if (img.complete && img.naturalWidth > 0) {
		register(img.naturalWidth / img.naturalHeight);
	}
});

const flexBasis = $derived(context ? context.getFlexBasis(id) : '1');
</script>

<div class="h-full" style={`flex-basis: ${flexBasis}; flex-shrink: 0;`}>
	{#if isVideo}
		<video
			bind:this={videoRef}
			class="media-fill"
			src={fullUrl}
			muted
			loop
			playsinline
			preload="metadata"
			crossorigin="anonymous"
			referrerpolicy="origin"
			onloadedmetadata={handleVideoMetadata}
		></video>
	{:else}
		<img
			bind:this={imageRef}
			class="media-fill"
			src={fullUrl}
			alt={alt}
			loading="lazy"
			decoding="async"
			crossorigin="anonymous"
			referrerpolicy="origin"
			onload={handleImageLoad}
		/>
	{/if}
</div>
