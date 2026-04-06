<script lang="ts">
	import { prefersReducedMotion } from "svelte/motion";
	import { CDN } from "$lib/constants";
	import { observeVisibility } from "$lib/observe";
	import type { HomeArtifactGroups as ArtifactGroups } from "$lib/types/artifacts";

	type ParsedThumbnail = {
		filename: string;
		ratio: number;
	};

	let { artifacts }: { artifacts: ArtifactGroups } = $props();

	let expandedFragments = $state(false);
	let visibleRows = $state(new Set<string>());

	const INITIAL_VISIBLE_FRAGMENT_COUNT = 4;
	const MAX_STUDY_THUMBNAILS = 4;
	const DEFAULT_RATIO = 2;
	const THUMB_HEIGHT = 40;
	const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});

	const hasMoreWriting = $derived(
		artifacts.fragments.length > INITIAL_VISIBLE_FRAGMENT_COUNT,
	);
	const showAllFragments = $derived(
		expandedFragments || !hasMoreWriting,
	);
	const visibleFragments = $derived(
		showAllFragments
			? artifacts.fragments
			: artifacts.fragments.slice(0, INITIAL_VISIBLE_FRAGMENT_COUNT),
	);
	const writingToggleLabel = $derived(
		showAllFragments ? "Show less writing" : "Show more writing",
	);

	const markRowVisible = (slug: string): void => {
		if (visibleRows.has(slug)) return;
		visibleRows = new Set([...visibleRows, slug]);
	};

	const isRowVisible = (slug: string): boolean => {
		return prefersReducedMotion.current || visibleRows.has(slug);
	};

	const formatDate = (date: string): string => {
		const parsed = new Date(date);
		if (Number.isNaN(parsed.getTime())) {
			return date;
		}
		return DATE_FORMATTER.format(parsed);
	};

	const parseMediaSrc = (src: string): ParsedThumbnail => {
		const match = src.match(/^(.+)@([\d.]+)$/);
		if (match && match[1] && match[2]) {
			return { filename: match[1], ratio: parseFloat(match[2]) };
		}
		return { filename: src, ratio: DEFAULT_RATIO };
	};

	const getStudyThumbnails = (sources: string[]): ParsedThumbnail[] => {
		return sources.slice(0, MAX_STUDY_THUMBNAILS).map(parseMediaSrc);
	};

	const toMediaUrl = (filename: string): string => {
		return `${CDN.mediaUrl}${filename}`;
	};
</script>

<section id="artifacts" class="grid-section-full py-44">
	<header class="col-content mb-16">
		<p class="font-mono text-muted">[ 02 ARTIFACTS ]</p>
	</header>

	<div class="col-content flex flex-col gap-12">
		{#if artifacts.fragments.length > 0}
			<section aria-labelledby="artifacts-writing" class="flex flex-col">
				<header class="mb-3">
					<h2 id="artifacts-writing" class="font-mono text-muted">
						Writing
					</h2>
				</header>

				<div id="artifacts-writing-list" class="flex flex-col">
					{#each visibleFragments as artifact (artifact.slug)}
						<article
							use:observeVisibility={{
								onEnter: () => markRowVisible(artifact.slug),
								once: true,
								rootMargin: "-30px",
								threshold: 0.1,
								disabled: prefersReducedMotion.current,
							}}
							class="relative transition-all duration-500 [transition-timing-function:var(--ease-settle)] [&+article]:border-t [&+article]:border-current/10"
							class:opacity-0={!isRowVisible(artifact.slug)}
							class:translate-y-5={!isRowVisible(artifact.slug)}
							class:opacity-100={isRowVisible(artifact.slug)}
							class:translate-y-0={isRowVisible(artifact.slug)}
						>
							<a
								href="/{artifact.slug}"
								class="group relative block py-6 pl-4 focus-ring external-link-feedback"
							>
								<div
									class="pointer-events-none absolute left-0 top-0 h-full w-px bg-transparent transition-colors duration-150 group-hover:bg-current/25 group-focus-visible:bg-current/25"
									aria-hidden="true"
								></div>

								<div
									class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"
								>
									<h3
										class="font-subtitle pr-3 transition-colors duration-150 group-hover:text-foreground"
									>
										{artifact.title}
									</h3>
									<time
										class="font-mono text-muted shrink-0 text-right [font-variant-numeric:tabular-nums] transition-colors duration-150 group-hover:text-foreground/70"
										datetime={artifact.date}
									>
										{formatDate(artifact.date)}
									</time>
								</div>

								<p
									class="mt-2 text-muted transition-colors duration-150 group-hover:text-foreground/80"
								>
									{artifact.description}
								</p>
							</a>
						</article>
					{/each}
				</div>

				{#if hasMoreWriting}
					<button
						type="button"
						onclick={() => {
							expandedFragments = !expandedFragments;
						}}
						aria-controls="artifacts-writing-list"
						aria-expanded={showAllFragments}
						class="mt-3 inline-flex min-h-[44px] w-fit items-center rounded-sm pl-4 py-1 font-mono text-muted transition-colors duration-150 hover:text-foreground focus-ring pressed-state"
					>
						{writingToggleLabel}
					</button>
				{/if}
			</section>
		{/if}

		{#if artifacts.studies.length > 0}
			<section aria-labelledby="artifacts-studies" class="flex flex-col">
				<header class="mb-3">
					<h2 id="artifacts-studies" class="font-mono text-muted">
						Studies
					</h2>
				</header>

				<div class="flex flex-col">
					{#each artifacts.studies as artifact (artifact.slug)}
						<article
							use:observeVisibility={{
								onEnter: () => markRowVisible(artifact.slug),
								once: true,
								rootMargin: "-30px",
								threshold: 0.1,
								disabled: prefersReducedMotion.current,
							}}
							class="relative transition-all duration-500 [transition-timing-function:var(--ease-settle)] [&+article]:border-t [&+article]:border-current/10"
							class:opacity-0={!isRowVisible(artifact.slug)}
							class:translate-y-5={!isRowVisible(artifact.slug)}
							class:opacity-100={isRowVisible(artifact.slug)}
							class:translate-y-0={isRowVisible(artifact.slug)}
						>
							{#if artifact.isConfidential}
								<div class="py-6 pl-4 opacity-65">
									<div
										class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"
									>
										<h3
											class="font-subtitle pr-3 text-muted/90"
										>
											{artifact.title}
										</h3>
										<time
											class="font-mono text-muted/55 shrink-0 text-right [font-variant-numeric:tabular-nums]"
											datetime={artifact.date}
										>
											{formatDate(artifact.date)}
										</time>
									</div>

									<p class="mt-2 text-muted/60">
										Confidential
									</p>
								</div>
							{:else}
								{@const thumbnails = getStudyThumbnails(
									artifact.thumbnails,
								)}
								<a
									href="/{artifact.slug}"
									class="group relative block py-6 pl-4 focus-ring external-link-feedback"
								>
									<div
										class="pointer-events-none absolute left-0 top-0 h-full w-px bg-transparent transition-colors duration-150 group-hover:bg-current/25 group-focus-visible:bg-current/25"
										aria-hidden="true"
									></div>

									<div
										class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"
									>
										<h3
											class="font-subtitle pr-3 transition-colors duration-150 group-hover:text-foreground"
										>
											{artifact.title}
										</h3>
										<time
											class="font-mono text-muted shrink-0 text-right [font-variant-numeric:tabular-nums] transition-colors duration-150 group-hover:text-foreground/70"
											datetime={artifact.date}
										>
											{formatDate(artifact.date)}
										</time>
									</div>

									<p
										class="mt-2 text-muted transition-colors duration-150 group-hover:text-foreground/80"
									>
										{artifact.description}
									</p>

									{#if thumbnails.length > 0}
										<div
											class="mt-4 flex gap-1 overflow-hidden"
											aria-hidden="true"
										>
											{#each thumbnails as thumbnail}
												{@const width = Math.min(
													Math.round(
														THUMB_HEIGHT *
															thumbnail.ratio,
													),
													96,
												)}
												<div
													class="h-16 max-w-[96px] shrink-0 overflow-hidden rounded-sm opacity-78 transition-opacity duration-150 group-hover:opacity-100"
													style:width={`${width}px`}
												>
													<img
														src={toMediaUrl(
															thumbnail.filename,
														)}
														alt=""
														loading="lazy"
														decoding="async"
														class="h-full w-full object-cover"
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
		{/if}

		{#if artifacts.other.length > 0}
			<section aria-labelledby="artifacts-other" class="flex flex-col">
				<header class="mb-3">
					<h2 id="artifacts-other" class="font-mono text-muted">
						Other
					</h2>
				</header>

				<div class="flex flex-col">
					{#each artifacts.other as artifact (artifact.slug)}
						<article
							use:observeVisibility={{
								onEnter: () => markRowVisible(artifact.slug),
								once: true,
								rootMargin: "-30px",
								threshold: 0.1,
								disabled: prefersReducedMotion.current,
							}}
							class="relative transition-all duration-500 [transition-timing-function:var(--ease-settle)] [&+article]:border-t [&+article]:border-current/10"
							class:opacity-0={!isRowVisible(artifact.slug)}
							class:translate-y-5={!isRowVisible(artifact.slug)}
							class:opacity-100={isRowVisible(artifact.slug)}
							class:translate-y-0={isRowVisible(artifact.slug)}
						>
							<a
								href="/{artifact.slug}"
								class="group relative block py-6 pl-4 focus-ring external-link-feedback"
							>
								<div
									class="pointer-events-none absolute left-0 top-0 h-full w-px bg-transparent transition-colors duration-150 group-hover:bg-current/25 group-focus-visible:bg-current/25"
									aria-hidden="true"
								></div>

								<div
									class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1"
								>
									<h3
										class="font-subtitle pr-3 transition-colors duration-150 group-hover:text-foreground"
									>
										{artifact.title}
									</h3>
									<time
										class="font-mono text-muted shrink-0 text-right [font-variant-numeric:tabular-nums] transition-colors duration-150 group-hover:text-foreground/70"
										datetime={artifact.date}
									>
										{formatDate(artifact.date)}
									</time>
								</div>

								<p
									class="mt-2 text-muted transition-colors duration-150 group-hover:text-foreground/80"
								>
									{artifact.description}
								</p>
							</a>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</section>
