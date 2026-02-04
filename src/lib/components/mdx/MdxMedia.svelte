<script lang="ts">
import { onMount, setContext } from 'svelte';
import MdxMediaItem from '$lib/components/mdx/MdxMediaItem.svelte';
import { MEDIA_LAYOUT_CONTEXT, type MediaLayoutContextValue } from '$lib/components/mdx/mdx-context';

type Props = {
	src: string[];
	alt?: string;
};

let { src, alt = '' }: Props = $props();

let container = $state<HTMLDivElement | null>(null);
let containerWidth = $state(0);
let aspectRatios = $state(new Map<string, number>());

const registerItem = (id: string, aspectRatio: number) => {
	aspectRatios = new Map(aspectRatios);
	aspectRatios.set(id, aspectRatio);
};

const getFlexBasis = (id: string): string => {
	const ratio = aspectRatios.get(id);
	if (!ratio || aspectRatios.size === 0) {
		return '1';
	}

	const totalRatio = Array.from(aspectRatios.values()).reduce((sum, value) => sum + value, 0);
	const percentage = (ratio / totalRatio) * 100;
	return `${percentage}%`;
};

setContext<MediaLayoutContextValue>(MEDIA_LAYOUT_CONTEXT, {
	registerItem,
	getFlexBasis,
});

const totalRatio = $derived(Array.from(aspectRatios.values()).reduce((sum, value) => sum + value, 0));
const calculatedHeight = $derived(containerWidth > 0 && totalRatio > 0 ? containerWidth / totalRatio : 0);
const isLayoutReady = $derived(containerWidth > 0 && totalRatio > 0 && calculatedHeight > 0);

onMount(() => {
	if (!container) return;

	const updateWidth = () => {
		containerWidth = container?.offsetWidth ?? 0;
	};

	updateWidth();

	const resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
			containerWidth = width;
		}
	});

	resizeObserver.observe(container);

	return () => {
		resizeObserver.disconnect();
	};
});
</script>

<div
	bind:this={container}
	class={`w-full flex transition-opacity duration-300 ${isLayoutReady ? "opacity-100" : "opacity-0"}`}
	style={calculatedHeight > 0 ? `height: ${calculatedHeight}px;` : ""}
>
	{#each src as source (source)}
		<MdxMediaItem src={source} {alt} />
	{/each}
</div>
