import type { ImgHTMLAttributes, Ref, VideoHTMLAttributes } from 'react';

/**
 * Atomic media components (image and video) with optimized defaults.
 *
 * **React 19 Pattern:**
 * - Uses ref-as-prop pattern (imageRef/videoRef) instead of legacy forwardRef
 * - Refs are plain props in React 19 - simpler API, better type inference
 *
 * **AtomicImage - Current Implementation:**
 * - Wraps native <img> element with performance-optimized defaults
 * - Enables native lazy loading (loading="lazy")
 * - Uses async decoding for non-blocking rendering (decoding="async")
 * - No automatic image optimization (handled by BunnyCDN)
 *
 * **AtomicVideo - Current Implementation:**
 * - Wraps native <video> element with common defaults
 * - Auto-muted, looping, and inline playback for autoplay compatibility
 * - Programmatic control via optional videoRef prop
 *
 * **Migration Path:**
 * This wrapper enables centralized migration to next/image without refactoring
 * consumer code. When migrating, update implementation here while keeping
 * the same props interface.
 *
 * @example
 * ```tsx
 * // Image usage
 * <AtomicImage src="/image.jpg" alt="Description" />
 *
 * // Video usage with ref (React 19 pattern)
 * const myVideoRef = useRef<HTMLVideoElement>(null);
 * <AtomicVideo videoRef={myVideoRef} src="/video.mp4" onLoadedMetadata={handleLoad} />
 * ```
 */

export interface AtomicImageProps extends ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	alt: string;
	imageRef?: Ref<HTMLImageElement>;
}

export interface AtomicVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
	src: string;
	videoRef?: Ref<HTMLVideoElement>;
}

export function AtomicImage({
	src,
	alt,
	loading = 'lazy',
	decoding = 'async',
	imageRef,
	...props
}: AtomicImageProps) {
	return (
		// biome-ignore lint/performance/noImgElement: Future-proof wrapper for image optimization - enables centralized migration to next/image without refactoring consumer code
		<img
			ref={imageRef}
			src={src}
			alt={alt}
			loading={loading}
			decoding={decoding}
			className="media-fill"
			{...props}
		/>
	);
}

export function AtomicVideo({
	src,
	muted = true,
	loop = true,
	playsInline = true,
	videoRef,
	...props
}: AtomicVideoProps) {
	return (
		<video
			ref={videoRef}
			src={src}
			muted={muted}
			loop={loop}
			playsInline={playsInline}
			className="media-fill"
			{...props}
		/>
	);
}
