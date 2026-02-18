<script lang="ts">
	import { onMount } from "svelte";
	import { CDN } from "$lib/constants";
	import { observeVisibility } from "$lib/observe";

	type Props = {
		src: string;
		ratio: number;
		flexBasis: string;
		alt?: string;
	};

	let { src, ratio, flexBasis, alt = "" }: Props = $props();

	const fullUrl = $derived(`${CDN.mediaUrl}${src}`);
	const isVideo = $derived(
		src.toLowerCase().includes(".webm") || src.toLowerCase().includes(".mp4"),
	);

	let imageRef = $state<HTMLImageElement | null>(null);
	let videoRef = $state<HTMLVideoElement | null>(null);
	let prefersReducedMotion = $state(false);
	let isIntersecting = $state(false);
	let shouldLoadVideo = $state(false);
	let loaded = $state(false);

	onMount(() => {
		// Check for images that may have loaded from cache
		if (!isVideo && imageRef?.complete && imageRef.naturalWidth > 0) {
			loaded = true;
		}

		if (!isVideo) return;

		const motionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		const updateMotionPreference = () => {
			prefersReducedMotion = motionQuery.matches;
		};
		updateMotionPreference();
		motionQuery.addEventListener("change", updateMotionPreference);

		return () => {
			motionQuery.removeEventListener("change", updateMotionPreference);
		};
	});

	$effect(() => {
		if (!isVideo || !videoRef) return;
		if (prefersReducedMotion || !isIntersecting) {
			videoRef.pause();
			return;
		}
		videoRef.play().catch(() => {
			// autoplay may be blocked
		});
	});

	const handleImageLoad = () => {
		loaded = true;
	};

	const handleVideoMetadata = () => {
		loaded = true;
	};
</script>

<div
	class="h-full shrink-0"
	style:flex-basis={flexBasis}
	style:aspect-ratio={ratio}
>
	{#if isVideo}
		<div
			class="h-full w-full"
			use:observeVisibility={{
				onEnter: () => {
					isIntersecting = true;
					shouldLoadVideo = true;
				},
				onLeave: () => { isIntersecting = false; },
				once: false,
				rootMargin: '200px',
				threshold: 0.1,
			}}
		>
			{#if shouldLoadVideo}
				<video
					bind:this={videoRef}
					class="h-full w-full object-cover transform-gpu transition-opacity duration-200 {loaded
						? 'opacity-100'
						: 'opacity-0'}"
					src={fullUrl}
					width={Math.round(100 * ratio)}
					height={100}
					muted
					loop
					playsinline
					preload="metadata"
					crossorigin="anonymous"
					{...{ referrerpolicy: "origin" }}
					onloadedmetadata={handleVideoMetadata}
				></video>
			{/if}
		</div>
	{:else}
		<img
			bind:this={imageRef}
			class="h-full w-full object-cover transform-gpu transition-opacity duration-200 {loaded
				? 'opacity-100'
				: 'opacity-0'}"
			src={fullUrl}
			width={Math.round(100 * ratio)}
			height={100}
			{alt}
			loading="lazy"
			decoding="async"
			crossorigin="anonymous"
			{...{ referrerpolicy: "origin" }}
			onload={handleImageLoad}
		/>
	{/if}
</div>
