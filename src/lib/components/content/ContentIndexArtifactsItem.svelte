<script lang="ts">
import ContentIndexArtifactsItemThumbnails from '$lib/components/content/ContentIndexArtifactsItemThumbnails.svelte';
import { isStudy, type ParsedContent } from '$lib/content-types';
import type { MediaItem } from '$lib/mdx-client';

type Props = {
	item: ParsedContent;
	isConfidential: boolean;
	mediaItems: MediaItem[];
};

let { item, isConfidential, mediaItems }: Props = $props();

let isHovered = $state(false);

const frontmatter = $derived(item.frontmatter);
const title = $derived(frontmatter.title);
const slug = $derived(frontmatter.slug);
const description = $derived(frontmatter.description);
const dateValue = $derived(new Date(frontmatter.date));
const yearLabel = $derived(isStudy(frontmatter) ? String(dateValue.getFullYear()) : dateValue.toISOString().slice(0, 10).replace(/-/g, '/'));
const isoLabel = $derived(dateValue.toISOString());
const decorationClass = $derived(!isConfidential && isHovered ? 'decoration-current' : 'decoration-transparent');
</script>

{#if isConfidential}
	<div>
		<div
			role="presentation"
			class={`relative grid grid-cols-10 border-current/10 border-t py-5 pt-2 underline decoration-wavy transition-colors duration-250 ${decorationClass} ${isConfidential ? "cursor-not-allowed" : ""}`}
			onmouseenter={() => {
				isHovered = true;
			}}
			onmouseleave={() => {
				isHovered = false;
			}}
		>
			<p class="col-span-base row-start-1">{title.toUpperCase()}</p>
			<p
				class="col-span-full row-start-2 normal-case md:col-span-8 md:col-start-3 lg:col-span-7 lg:col-start-4 lg:row-start-2 xl:col-span-3 xl:col-start-5 xl:row-span-2 xl:row-start-2 2xl:col-span-4 2xl:col-start-2"
			>
				{isConfidential ? "Confidential" : description}
			</p>
			<p
				class="col-span-1 col-start-1 row-start-3 md:col-span-1 md:col-start-1 md:row-start-2"
			>
				{yearLabel}
			</p>
			<p
				class="-col-start-1 col-span-4 row-start-2 flex h-full select-none flex-col justify-center text-right font-mono md:col-span-1 md:col-start-1 md:row-start-1 md:pr-5 md:text-left"
			>
				<span>{isoLabel}</span>
			</p>
			<div class="col-span-base row-start--4 my-4">
				<ContentIndexArtifactsItemThumbnails
					{mediaItems}
					{slug}
					maxItems={8}
					{isHovered}
				/>
			</div>
		</div>
	</div>
{:else}
	<a
		href={`/${slug}`}
		onmouseenter={() => {
			isHovered = true;
		}}
		onmouseleave={() => {
			isHovered = false;
		}}
	>
		<div
			class={`relative grid grid-cols-10 border-current/10 border-t py-5 pt-2 underline decoration-wavy transition-colors duration-250 ${decorationClass}`}
		>
			<p class="col-span-base row-start-1">{title.toUpperCase()}</p>
			<p
				class="col-span-full row-start-2 normal-case md:col-span-8 md:col-start-3 lg:col-span-7 lg:col-start-4 lg:row-start-2 xl:col-span-3 xl:col-start-5 xl:row-span-2 xl:row-start-2 2xl:col-span-4 2xl:col-start-2"
			>
				{description}
			</p>
			<p
				class="col-span-1 col-start-1 row-start-3 md:col-span-1 md:col-start-1 md:row-start-2"
			>
				{yearLabel}
			</p>
			<p
				class="-col-start-1 col-span-4 row-start-2 flex h-full select-none flex-col justify-center text-right font-mono md:col-span-1 md:col-start-1 md:row-start-1 md:pr-5 md:text-left"
			>
				<span>{isoLabel}</span>
			</p>
			<div class="col-span-base row-start--4 my-4">
				<ContentIndexArtifactsItemThumbnails
					{mediaItems}
					{slug}
					maxItems={8}
					{isHovered}
				/>
			</div>
		</div>
	</a>
{/if}
