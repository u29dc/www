<script lang="ts">
	import { getContext, onMount } from "svelte";
	import {
		MEDIA_LAYOUT_CONTEXT,
		type MediaLayoutContextValue,
	} from "$lib/components/mdx/mdx-context";
	import { CDN } from "$lib/constants";

	type Props = {
		src: string;
		alt?: string;
	};

	let { src, alt = "" }: Props = $props();

	const context = getContext<MediaLayoutContextValue>(MEDIA_LAYOUT_CONTEXT);
	const id = Math.random().toString(36).slice(2);
	const fullUrl = $derived(`${CDN.mediaUrl}${src}`);
	const isVideo = $derived(
		src.toLowerCase().includes(".webm") ||
			src.toLowerCase().includes(".mp4"),
	);

	let imageRef = $state<HTMLImageElement | null>(null);
	let videoRef = $state<HTMLVideoElement | null>(null);
	let wrapperRef = $state<HTMLDivElement | null>(null);
	let prefersReducedMotion = $state(false);
	let isIntersecting = $state(false);
	let shouldLoadVideo = $state(false);

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
		if (!isVideo) {
			if (imageRef?.complete && imageRef.naturalWidth > 0) {
				register(imageRef.naturalWidth / imageRef.naturalHeight);
			}
			return;
		}

		if (!wrapperRef) return;

		const motionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		const updateMotionPreference = () => {
			prefersReducedMotion = motionQuery.matches;
		};
		updateMotionPreference();
		motionQuery.addEventListener("change", updateMotionPreference);

		let observer: IntersectionObserver | null = null;
		if (typeof IntersectionObserver === "undefined") {
			isIntersecting = true;
			shouldLoadVideo = true;
		} else {
			observer = new IntersectionObserver(
				([entry]) => {
					const inView = entry?.isIntersecting ?? true;
					isIntersecting = inView;
					if (inView) {
						shouldLoadVideo = true;
					}
				},
				{ rootMargin: "200px", threshold: 0.1 },
			);
			observer.observe(wrapperRef);
		}

		return () => {
			motionQuery.removeEventListener("change", updateMotionPreference);
			observer?.disconnect();
		};
	});

	const flexBasis = $derived(context ? context.getFlexBasis(id) : "1");

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
</script>

<div class="h-full" style={`flex-basis: ${flexBasis}; flex-shrink: 0;`}>
	{#if isVideo}
		<div bind:this={wrapperRef} class="h-full w-full">
			{#if shouldLoadVideo}
				<video
					bind:this={videoRef}
					class="media-fill"
					src={fullUrl}
					muted
					loop
					playsinline
					preload="none"
					crossorigin="anonymous"
					{...{ referrerpolicy: "origin" }}
					onloadedmetadata={handleVideoMetadata}
				></video>
			{/if}
		</div>
	{:else}
		<img
			bind:this={imageRef}
			class="media-fill"
			src={fullUrl}
			{alt}
			loading="lazy"
			decoding="async"
			crossorigin="anonymous"
			{...{ referrerpolicy: "origin" }}
			onload={handleImageLoad}
		/>
	{/if}
</div>
