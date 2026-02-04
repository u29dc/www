<script lang="ts">
	import { onMount } from "svelte";
	import { CDN } from "$lib/constants";

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
	let prefersReducedMotion = $state(false);

	const MAX_THUMBNAILS = 6;

	const formatYear = (date: string): string => {
		return new Date(date).getFullYear().toString();
	};

	const formatDate = (date: string): string => {
		return new Date(date).toISOString().split("T")[0] ?? "";
	};

	const isImage = (filename: string): boolean => {
		const ext = filename.toLowerCase().split(".").pop() ?? "";
		return ["webp", "jpg", "jpeg", "png", "gif", "avif"].includes(ext);
	};

	const getThumbnails = (media: string[]): string[] => {
		return media.filter(isImage).slice(0, MAX_THUMBNAILS);
	};

	onMount(() => {
		prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (prefersReducedMotion) {
			visibleItems = new Set(artifacts.map((_, i) => i));
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = items.indexOf(
							entry.target as HTMLElement,
						);
						if (index !== -1) {
							visibleItems = new Set([...visibleItems, index]);
						}
					}
				}
			},
			{ threshold: 0.1, rootMargin: "-30px" },
		);

		for (const item of items) {
			if (item) observer.observe(item);
		}

		return () => observer.disconnect();
	});
</script>

<section id="artifacts" class="col-content py-32">
	<header class="mb-16">
		<h2 class="font-mono text-muted">[ 03 ARTIFACTS ]</h2>
	</header>

	<div class="flex flex-col">
		{#each artifacts as artifact, index}
			<article
				bind:this={items[index]}
				class="group relative cursor-pointer py-6 transition-all duration-500 [transition-timing-function:var(--ease-out)] [&+article]:border-t [&+article]:border-current/10"
				class:opacity-0={!visibleItems.has(index)}
				class:translate-y-5={!visibleItems.has(index)}
				class:opacity-100={visibleItems.has(index)}
				class:translate-y-0={visibleItems.has(index)}
				style:transition-delay={prefersReducedMotion
					? "0ms"
					: `${index * 90}ms`}
			>
				<div
					class="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-transparent transition-colors duration-200 group-hover:bg-current/40"
					aria-hidden="true"
				></div>

				{#if artifact.isConfidential}
					<div class="cursor-not-allowed pl-4">
						<div class="flex items-baseline gap-4">
							<span class="font-mono text-muted shrink-0"
								>{formatYear(artifact.date)}</span
							>
							<h3 class="font-subtitle text-muted">
								{artifact.title}
							</h3>
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
							<h3 class="font-subtitle">{artifact.title}</h3>
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
									<img
										src="{CDN.mediaUrl}{thumb}"
										alt=""
										loading="lazy"
										decoding="async"
										class="h-16 w-auto max-w-24 object-cover opacity-80 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
									/>
								{/each}
							</div>
						{/if}
					</a>
				{/if}
			</article>
		{/each}
	</div>
</section>
