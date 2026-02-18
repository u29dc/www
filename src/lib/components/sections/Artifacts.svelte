<script lang="ts">
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { CDN } from "$lib/constants";
	import { createStaggerObserver } from "$lib/observe";

	interface Artifact {
		slug: string;
		title: string;
		description: string;
		type: string;
		date: string;
		media: string[];
		isConfidential: boolean;
	}

	let { artifacts }: { artifacts: Artifact[] } = $props();

	let items: HTMLElement[] = $state([]);
	let visibleItems = $state(new Set<number>());

	const MAX_THUMBNAILS = 6;
	const DEFAULT_RATIO = 2;
	const THUMB_HEIGHT = 64; // h-16 = 64px

	type ParsedThumb = { filename: string; ratio: number };

	const parseMediaSrc = (src: string): ParsedThumb => {
		const match = src.match(/^(.+)@([\d.]+)$/);
		if (match && match[1] && match[2]) {
			return { filename: match[1], ratio: parseFloat(match[2]) };
		}
		return { filename: src, ratio: DEFAULT_RATIO };
	};

	const formatYear = (date: string): string => {
		return new Date(date).getFullYear().toString();
	};

	const formatDate = (date: string): string => {
		return new Date(date).toISOString().split("T")[0] ?? "";
	};

	const isImage = (filename: string): boolean => {
		const clean = filename.replace(/@[\d.]+$/, "");
		const ext = clean.toLowerCase().split(".").pop() ?? "";
		return ["webp", "jpg", "jpeg", "png", "gif", "avif"].includes(ext);
	};

	const getThumbnails = (media: string[]): ParsedThumb[] => {
		return media
			.filter(isImage)
			.slice(0, MAX_THUMBNAILS)
			.map(parseMediaSrc);
	};

	onMount(() => {
		if (prefersReducedMotion.current) {
			visibleItems = new Set(artifacts.map((_, i) => i));
			return;
		}

		const stagger = createStaggerObserver(
			items,
			(index) => {
				visibleItems = new Set([...visibleItems, index]);
			},
			{ threshold: 0.1, rootMargin: "-30px" },
		);

		return () => stagger.disconnect();
	});
</script>

<section id="artifacts" class="grid-section-full py-44">
	<header class="col-content mb-16">
		<p class="font-mono text-muted">[ 02 ARTIFACTS ]</p>
	</header>

	<div class="col-content flex flex-col">
		{#each artifacts as artifact, index}
			<article
				bind:this={items[index]}
				class="relative py-6 transition-all duration-500 [transition-timing-function:var(--ease-settle)] [&+article]:border-t [&+article]:border-current/10"
				class:group={!artifact.isConfidential}
				class:cursor-pointer={!artifact.isConfidential}
				class:opacity-0={!visibleItems.has(index)}
				class:translate-y-5={!visibleItems.has(index)}
				class:opacity-100={visibleItems.has(index)}
				class:translate-y-0={visibleItems.has(index)}
				style:transition-delay={prefersReducedMotion.current
					? "0ms"
					: `${index * 90}ms`}
			>
				{#if !artifact.isConfidential}
					<div
						class="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-transparent transition-colors duration-200 group-hover:bg-current/40"
						aria-hidden="true"
					></div>
				{/if}

				{#if artifact.isConfidential}
					<div class="pl-4 opacity-60">
						<div class="flex items-baseline gap-4">
							<span class="font-mono text-muted shrink-0"
								>{formatYear(artifact.date)}</span
							>
							<h2 class="font-subtitle text-muted">
								{artifact.title}
							</h2>
							<span
								class="font-mono text-muted/50 ml-auto shrink-0"
								>{formatDate(artifact.date)}</span
							>
						</div>
						<p class="mt-2 pl-12 text-muted/50">Confidential</p>
					</div>
				{:else}
					{@const thumbnails = getThumbnails(artifact.media)}
					<a href="/{artifact.slug}" class="block pl-4">
						<div class="flex flex-wrap items-baseline gap-4">
							<span class="font-mono text-muted shrink-0"
								>{formatYear(artifact.date)}</span
							>
							<h2 class="font-subtitle">{artifact.title}</h2>
							<span
								class="font-mono text-muted ml-auto shrink-0 hidden sm:inline"
								>{formatDate(artifact.date)}</span
							>
						</div>
						<p class="mt-2 pl-12 text-muted">
							{artifact.description}
						</p>

						{#if thumbnails.length > 0}
							<div class="mt-4 flex gap-1 overflow-hidden pl-12">
								{#each thumbnails as thumb}
									{@const width = THUMB_HEIGHT * thumb.ratio}
									<div
										class="h-16 max-w-[96px] shrink-0 overflow-hidden rounded-sm"
										style:width="{width}px"
									>
										<img
											src="{CDN.mediaUrl}{thumb.filename}"
											width={Math.min(
												Math.round(
													THUMB_HEIGHT * thumb.ratio,
												),
												96,
											)}
											height={THUMB_HEIGHT}
											alt="{artifact.title} preview"
											loading="lazy"
											decoding="async"
											class="h-full w-full object-cover opacity-80 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
										/>
									</div>
								{/each}
							</div>
						{/if}
					</a>
				{/if}
			</article>
		{/each}
	</div>
</section>
