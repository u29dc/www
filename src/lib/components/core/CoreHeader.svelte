<script lang="ts">
	import { page } from "$app/state";
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import AtomicHeaderButton from "$lib/components/atomic/AtomicHeaderButton.svelte";
	import { createActiveTracker } from "$lib/observe";

	const sections = [
		{ id: "signal", num: "00", name: "Signal" },
		{ id: "protocols", num: "01", name: "Protocols" },
		{ id: "artifacts", num: "02", name: "Artifacts" },
		{ id: "origin", num: "03", name: "Origin" },
	];

	const isSlugPage = $derived(page.route.id === "/[slug]");
	const articleTitle = $derived(
		(page.data?.["frontmatter"] as { title?: string } | undefined)?.title,
	);
	const SLUG_HERO_SELECTOR = "[data-slug-hero]";
	const SLUG_HEADER_REVEAL_OFFSET_PX = 84;

	let activeSection = $state<string | null>(null);
	let navRefs: HTMLAnchorElement[] = [];
	let navContainer: HTMLElement | null = $state(null);
	let lastLeft = $state("0px");
	let lastWidth = $state("0px");
	let indicatorPrimed = $state(false);
	let indicatorVisible = $state(false);
	let indicatorBooting = $state(false);
	let indicatorTransitionMode = $state<"none" | "opacity" | "full">("none");
	let indicatorOpacityDurationMs = $state(420);
	let revealFrame: number | null = null;
	let revealTimeout: ReturnType<typeof setTimeout> | null = null;
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let promoteTimeout: ReturnType<typeof setTimeout> | null = null;
	let navIntentSection = $state<string | null>(null);
	let navIntentTimeout: ReturnType<typeof setTimeout> | null = null;
	let slugTitleVisible = $state(false);
	const INITIAL_INDICATOR_FADE_DELAY_MS = 80;
	const INITIAL_INDICATOR_FADE_MS = 420;
	const INDICATOR_FADE_OUT_MS = 560;
	const NAV_INTENT_LOCK_MS = 900;

	const cancelIndicatorTransitions = () => {
		if (revealFrame !== null) {
			cancelAnimationFrame(revealFrame);
			revealFrame = null;
		}
		if (revealTimeout !== null) {
			clearTimeout(revealTimeout);
			revealTimeout = null;
		}
		if (hideTimeout !== null) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
		if (promoteTimeout !== null) {
			clearTimeout(promoteTimeout);
			promoteTimeout = null;
		}
	};

	const clearNavIntent = () => {
		if (navIntentTimeout !== null) {
			clearTimeout(navIntentTimeout);
			navIntentTimeout = null;
		}
		navIntentSection = null;
	};

	const handleSectionNavClick = (sectionId: string) => {
		clearNavIntent();
		navIntentSection = sectionId;
		navIntentTimeout = setTimeout(() => {
			navIntentTimeout = null;
			navIntentSection = null;
		}, NAV_INTENT_LOCK_MS);

		activeSection = sectionId;
		requestAnimationFrame(() => {
			const hasPosition = updateIndicatorPosition();
			if (!hasPosition) return;

			cancelIndicatorTransitions();
			indicatorPrimed = true;
			indicatorBooting = false;
			indicatorTransitionMode = "full";
			indicatorVisible = true;
		});
	};

	const updateIndicatorPosition = (): boolean => {
		if (!activeSection || !navContainer) return false;

		const index = sections.findIndex((s) => s.id === activeSection);
		const el = navRefs[index];
		if (!el) return false;

		const navRect = navContainer.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		lastLeft = `${elRect.left - navRect.left}px`;
		lastWidth = `${elRect.width}px`;
		return true;
	};

	// Track position with effect (runs when activeSection changes)
	$effect(() => {
		if (!activeSection) {
			cancelIndicatorTransitions();
			indicatorBooting = false;

			if (indicatorVisible) {
				indicatorOpacityDurationMs = INDICATOR_FADE_OUT_MS;
				indicatorTransitionMode = "opacity";
				indicatorVisible = false;
				indicatorPrimed = false;
				hideTimeout = setTimeout(() => {
					indicatorTransitionMode = "none";
					hideTimeout = null;
				}, INDICATOR_FADE_OUT_MS);
				return;
			}

			indicatorVisible = false;
			indicatorPrimed = false;
			indicatorTransitionMode = "none";
			return;
		}

		const hasPosition = updateIndicatorPosition();
		if (!hasPosition) return;

		if (!indicatorPrimed) {
			cancelIndicatorTransitions();
			indicatorPrimed = true;
			indicatorVisible = false;
			indicatorBooting = true;
			indicatorTransitionMode = "none";
			revealFrame = requestAnimationFrame(() => {
				indicatorOpacityDurationMs = INITIAL_INDICATOR_FADE_MS;
				indicatorTransitionMode = "opacity";
				revealFrame = requestAnimationFrame(() => {
					if (activeSection) {
						revealTimeout = setTimeout(() => {
							if (!activeSection) return;
							indicatorVisible = true;
							promoteTimeout = setTimeout(() => {
								indicatorTransitionMode = "full";
								indicatorBooting = false;
								promoteTimeout = null;
							}, INITIAL_INDICATOR_FADE_MS);
							revealTimeout = null;
						}, INITIAL_INDICATOR_FADE_DELAY_MS);
					}
					revealFrame = null;
				});
			});
			return;
		}

		if (indicatorBooting) {
			return;
		}

		cancelIndicatorTransitions();
		indicatorTransitionMode = "full";
		indicatorVisible = true;
	});

	// Pure derived - no mutations
	const indicatorStyle = $derived.by(() => {
		if (!activeSection) {
			return {
				opacity: 0,
				left: lastLeft,
				width: lastWidth,
			};
		}
		if (!indicatorVisible) {
			return {
				opacity: 0,
				left: lastLeft,
				width: lastWidth,
			};
		}
		return {
			opacity: 1,
			left: lastLeft,
			width: lastWidth,
		};
	});

	const indicatorTransitionClass = $derived.by(() => {
		if (indicatorTransitionMode === "full") {
			return "transition-[left,width,opacity]";
		}
		if (indicatorTransitionMode === "opacity") {
			return "transition-opacity";
		}
		return "transition-none";
	});

	const indicatorTransitionDuration = $derived.by(() => {
		if (indicatorTransitionMode === "full") {
			return "var(--duration-breath)";
		}
		if (indicatorTransitionMode === "opacity") {
			return `${indicatorOpacityDurationMs}ms`;
		}
		return "0ms";
	});

	const indicatorTransitionTiming = $derived.by(() => {
		if (indicatorTransitionMode === "full") {
			return "var(--ease-settle)";
		}
		return "ease-in-out";
	});

	const indicatorWillChange = $derived.by(() => {
		if (!activeSection || !indicatorVisible) {
			return "opacity";
		}
		return indicatorTransitionMode === "full"
			? "left, width, opacity"
			: "opacity";
	});

	const navStateClass = $derived.by(() => {
		if (!isSlugPage) {
			return "p-[5px] transition-all duration-300";
		}
		return slugTitleVisible
			? "max-h-[44px] px-[5px] py-[5px] opacity-100 pointer-events-auto transition-[opacity,max-height,padding] duration-300 ease-[var(--ease-settle)]"
			: "max-h-0 px-[5px] py-0 opacity-0 pointer-events-none transition-[opacity,max-height,padding] duration-300 ease-[var(--ease-settle)]";
	});

	$effect(() => {
		if (typeof window === "undefined" || !isSlugPage) {
			return;
		}

		slugTitleVisible = false;
		let slugObserver: IntersectionObserver | null = null;
		let retryFrame: number | null = null;
		let attempts = 0;
		const maxAttempts = 60;

		const setupSlugObserver = (): boolean => {
			const hero =
				document.querySelector<HTMLElement>(SLUG_HERO_SELECTOR);
			if (!hero) return false;

			slugObserver = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					if (!entry) return;
					slugTitleVisible = !entry.isIntersecting;
				},
				{
					root: null,
					threshold: 0,
					rootMargin: `-${SLUG_HEADER_REVEAL_OFFSET_PX}px 0px 0px 0px`,
				},
			);

			slugObserver.observe(hero);
			return true;
		};

		const tryAttach = () => {
			if (setupSlugObserver()) return;
			attempts += 1;
			if (attempts >= maxAttempts) {
				slugTitleVisible = true;
				return;
			}
			retryFrame = requestAnimationFrame(tryAttach);
		};

		tryAttach();

		return () => {
			if (retryFrame !== null) {
				cancelAnimationFrame(retryFrame);
			}
			slugObserver?.disconnect();
		};
	});

	$effect(() => {
		if (typeof window === "undefined" || isSlugPage) {
			return;
		}

		const trackedIds = sections.map(({ id }) => id);
		let tracker: { disconnect: () => void } | null = null;
		let trackerAttachFrame: number | null = null;
		let trackerAttachAttempts = 0;
		const trackerAttachMaxAttempts = 120;

		const attachTracker = () => {
			const hasAnyTrackedSection = trackedIds.some(
				(id) => document.getElementById(id) !== null,
			);
			if (!hasAnyTrackedSection) {
				trackerAttachAttempts += 1;
				if (trackerAttachAttempts < trackerAttachMaxAttempts) {
					trackerAttachFrame = requestAnimationFrame(attachTracker);
				}
				return;
			}

			tracker = createActiveTracker(trackedIds, (activeId) => {
				if (navIntentSection) {
					if (activeId === navIntentSection) {
						clearNavIntent();
						activeSection = activeId;
					}
					// Ignore transient null or neighboring section hits while anchor scroll settles.
					return;
				}
				activeSection = activeId;
			});
		};

		attachTracker();

		const scheduleIndicatorUpdate = () => {
			requestAnimationFrame(() => {
				updateIndicatorPosition();
			});
		};

		const resizeObserver = new ResizeObserver(() => {
			scheduleIndicatorUpdate();
		});

		if (navContainer) {
			resizeObserver.observe(navContainer);
		}
		for (const link of navRefs) {
			if (link) {
				resizeObserver.observe(link);
			}
		}

		window.addEventListener("resize", scheduleIndicatorUpdate);
		const fontSet = document.fonts;
		const supportsFontEvents =
			typeof fontSet !== "undefined" &&
			typeof fontSet.addEventListener === "function";
		if (supportsFontEvents) {
			fontSet.addEventListener("loadingdone", scheduleIndicatorUpdate);
		}
		scheduleIndicatorUpdate();

			return () => {
				if (trackerAttachFrame !== null) {
					cancelAnimationFrame(trackerAttachFrame);
				}
				clearNavIntent();
				cancelIndicatorTransitions();
				tracker?.disconnect();
				resizeObserver.disconnect();
			window.removeEventListener("resize", scheduleIndicatorUpdate);
			if (supportsFontEvents) {
				fontSet.removeEventListener(
					"loadingdone",
					scheduleIndicatorUpdate,
				);
			}
		};
	});
</script>

<header class="fixed top-4 left-0 right-0 z-chrome grid-page">
	<nav
		bind:this={navContainer}
		aria-label="Main navigation"
		class="relative col-content flex w-full origin-top select-none items-center overflow-hidden rounded-lg bg-white/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl {navStateClass}"
	>
		{#if isSlugPage}
			<div class="relative flex min-h-[30px] w-full min-w-0 items-center">
				<AtomicHeaderButton
					href="/"
					class="absolute left-0 z-content inline-flex items-center gap-2"
				>
					<ArrowLeft size={14} />
					Back
				</AtomicHeaderButton>

				<div
					class="flex w-full min-w-0 items-center justify-center px-12"
				>
					{#if articleTitle}
						<span
							class="max-w-full truncate px-3 text-center font-mono font-xs text-black/60 transition-opacity duration-300 ease-[var(--ease-settle)] {slugTitleVisible
								? 'opacity-100'
								: 'opacity-0'}"
						>
							{articleTitle}
						</span>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex w-full min-w-0 items-center justify-center">
				<div class="flex min-w-0 items-center gap-2">
					<!-- Sliding indicator -->
					<div
						class="pointer-events-none absolute top-[5px] h-[30px] transform-gpu rounded-md bg-black/5 [backface-visibility:hidden] {indicatorTransitionClass}"
						style="left: {indicatorStyle.left}; width: {indicatorStyle.width}; opacity: {indicatorStyle.opacity}; transition-duration: {indicatorTransitionDuration}; transition-timing-function: {indicatorTransitionTiming}; will-change: {indicatorWillChange};"
						aria-hidden="true"
					></div>

						<!-- Section links -->
						{#each sections as section, i}
							<a
								bind:this={navRefs[i]}
								href="#{section.id}"
								onclick={() => handleSectionNavClick(section.id)}
								class="z-content inline-flex min-h-[30px] items-center rounded-md px-2 font-mono font-xs text-black/60 transition-colors focus-ring pressed-state hover-text-solid sm:px-3 {activeSection ===
								section.id
									? 'text-black'
									: ''}"
								aria-label={`${section.num} ${section.name}`}
								aria-current={activeSection === section.id
									? "page"
									: undefined}
							>
								<span aria-hidden="true" class="sm:hidden uppercase"
									>{section.name}</span
								>
								<span class="hidden sm:inline"
									>{section.num}
									{section.name}</span
								>
							</a>
							{#if i < sections.length - 1}
								<span
									aria-hidden="true"
									class="font-mono font-xs text-black/20 sm:hidden"
								>
									|
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
	</nav>
</header>
