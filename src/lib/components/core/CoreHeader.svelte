<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import AtomicBrandLogo from "$lib/components/atomic/AtomicBrandLogo.svelte";
	import AtomicHeaderButton from "$lib/components/atomic/AtomicHeaderButton.svelte";
	import { createActiveTracker } from "$lib/observe";

	const sections = [
		{ id: "signal", num: "01", name: "Signal" },
		{ id: "protocols", num: "02", name: "Protocols" },
		{ id: "artifacts", num: "03", name: "Artifacts" },
		{ id: "axioms", num: "04", name: "Axioms" },
		{ id: "origin", num: "05", name: "Origin" },
	];

	const isSlugPage = $derived(page.route.id === "/[slug]");
	const articleTitle = $derived(
		(page.data?.["frontmatter"] as { title?: string } | undefined)?.title,
	);

	let activeSection = $state<string | null>(null);
	let navRefs: HTMLAnchorElement[] = [];
	let navContainer: HTMLElement | null = $state(null);
	let lastLeft = $state("0px");
	let lastWidth = $state("0px");

	const updateIndicatorPosition = () => {
		if (!activeSection || !navContainer) return;

		const index = sections.findIndex((s) => s.id === activeSection);
		const el = navRefs[index];
		if (!el) return;

		const navRect = navContainer.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		lastLeft = `${elRect.left - navRect.left}px`;
		lastWidth = `${elRect.width}px`;
	};

	// Track position with effect (runs when activeSection changes)
	$effect(() => {
		updateIndicatorPosition();
	});

	// Pure derived - no mutations
	const indicatorStyle = $derived.by(() => {
		if (!activeSection) {
			return {
				opacity: 0,
				transform: "scaleX(0)",
				left: lastLeft,
				width: lastWidth,
			};
		}
		return {
			opacity: 1,
			transform: "scaleX(1)",
			left: lastLeft,
			width: lastWidth,
		};
	});

	const indicatorWillChange = $derived(
		activeSection ? "left, width, transform, opacity" : "auto",
	);

	onMount(() => {
		if (isSlugPage) return;

		const tracker = createActiveTracker(
			sections.map(({ id }) => id),
			(activeId) => {
				activeSection = activeId;
			},
		);

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
			tracker.disconnect();
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
		class="relative col-content flex w-full select-none items-center rounded-lg bg-white/80 p-[5px] shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300"
	>
		{#if isSlugPage}
			<div class="flex w-full min-w-0 items-center gap-2">
				<!-- Back button -->
				<AtomicHeaderButton
					href="/"
					class="inline-flex items-center gap-2"
				>
					<ArrowLeft size={14} />
					Back
				</AtomicHeaderButton>

				<!-- Divider -->
				<div class="h-4 w-px bg-black/10" aria-hidden="true"></div>

				<!-- Brand name -->
				<span
					class="hidden font-mono text-[9px] text-black/60 uppercase sm:inline"
				>
					Incomplete Infinity
				</span>

				<!-- Divider -->
				<div
					class="hidden h-4 w-px bg-black/10 sm:block"
					aria-hidden="true"
				></div>

				<!-- Article title -->
				{#if articleTitle}
					<span
						class="truncate font-mono text-[9px] text-black/60 uppercase"
					>
						{articleTitle}
					</span>
				{/if}
			</div>
		{:else}
			<div
				class="grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-2 sm:grid-cols-[auto_1fr_auto]"
			>
				<div class="flex min-w-0 items-center gap-2">
					<!-- Logo -->
					<div class="relative min-h-[30px] w-[80px]">
						<div
							class="absolute top-1/2 left-1/2 w-0 -translate-x-1/2 -translate-y-1/2 overflow-visible"
						>
							<AtomicBrandLogo
								width={60}
								theme="light"
								noiseIntensity={0.1}
								blurStart={1.5}
								defaultBlurIntensity={0.2}
								mouseBlurIntensity={0.4}
								mouseBlurSize={0.2}
								className="-translate-x-1/2"
							/>
						</div>
					</div>

					<!-- Divider -->
					<div
						class="hidden h-4 w-px bg-black/10 sm:block"
						aria-hidden="true"
					></div>
				</div>

				<div class="flex min-w-0 items-center justify-center gap-2">
					<!-- Sliding indicator -->
					<div
						class="pointer-events-none absolute top-[5px] h-[30px] transform-gpu rounded-md bg-black/5 transition-all duration-[var(--duration-breath)] ease-[var(--ease-settle)] [backface-visibility:hidden]"
						style="left: {indicatorStyle.left}; width: {indicatorStyle.width}; opacity: {indicatorStyle.opacity}; transform: {indicatorStyle.transform}; will-change: {indicatorWillChange};"
						aria-hidden="true"
					></div>

					<!-- Section links -->
					{#each sections as section, i}
						<a
							bind:this={navRefs[i]}
							href="#{section.id}"
							class="z-content hidden min-h-[30px] items-center rounded-md px-3 font-mono font-xs text-black/60 transition-colors focus-ring pressed-state hover-text-solid sm:inline-flex {activeSection ===
							section.id
								? 'text-black'
								: ''}"
							aria-current={activeSection === section.id
								? "page"
								: undefined}
						>
							{section.num}
							{section.name}
						</a>
						{/each}
				</div>

				<!-- Right spacer balances logo width so nav links stay centered -->
				<div class="hidden h-[30px] w-[89px] shrink-0 sm:block" aria-hidden="true"></div>
			</div>
		{/if}
	</nav>
</header>
