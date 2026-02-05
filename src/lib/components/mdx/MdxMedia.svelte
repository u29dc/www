<script lang="ts">
	import { setContext } from "svelte";
	import MdxMediaItem from "$lib/components/mdx/MdxMediaItem.svelte";
	import {
		MEDIA_LAYOUT_CONTEXT,
		type MediaLayoutContextValue,
	} from "$lib/components/mdx/mdx-context";

	type Props = {
		src: string[];
		alt?: string;
	};

	let { src, alt = "" }: Props = $props();

	const DEFAULT_RATIO = 2; // 2:1 aspect ratio (width/height)

	type ParsedSource = {
		filename: string;
		ratio: number;
	};

	function parseMediaSrc(srcString: string): ParsedSource {
		const match = srcString.match(/^(.+)@([\d.]+)$/);
		if (match && match[1] && match[2]) {
			return { filename: match[1], ratio: parseFloat(match[2]) };
		}
		return { filename: srcString, ratio: DEFAULT_RATIO };
	}

	const parsedSources = $derived(src.map(parseMediaSrc));
	const totalRatio = $derived(
		parsedSources.reduce((sum, s) => sum + s.ratio, 0),
	);

	// Calculate flex basis for each item based on pre-declared ratios
	const getFlexBasis = (index: number): string => {
		if (totalRatio === 0) return "1";
		const source = parsedSources[index];
		if (!source) return "1";
		const percentage = (source.ratio / totalRatio) * 100;
		return `${percentage}%`;
	};

	// Provide context for MdxMediaItem (simplified - no registration needed)
	setContext<MediaLayoutContextValue>(MEDIA_LAYOUT_CONTEXT, {
		registerItem: () => {}, // No-op, ratios are pre-declared
		getFlexBasis: () => "1", // Not used, we pass flex basis directly
	});
</script>

<div class="flex w-full" style:aspect-ratio={totalRatio}>
	{#each parsedSources as source, index (source.filename)}
		<MdxMediaItem
			src={source.filename}
			ratio={source.ratio}
			flexBasis={getFlexBasis(index)}
			{alt}
		/>
	{/each}
</div>
