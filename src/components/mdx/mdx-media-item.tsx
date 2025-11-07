'use client';

/**
 * MDX Media Item
 *
 * ## SUMMARY
 * Individual media item calculating aspect ratio and applying proportional flex-basis.
 *
 * ## RESPONSIBILITIES
 * - Load media dimensions, calculate aspect ratio, register with parent context
 *
 * ## KEY FLOWS
 * 1. Detect media type, load from BunnyCDN
 * 2. Extract dimensions on load event or cached media
 * 3. Calculate aspect ratio, register with parent
 * 4. Receive flex-basis from parent and apply to container
 *
 * @module components/mdx/mdx-media_item
 */

import { motion } from 'motion/react';
import type { SyntheticEvent } from 'react';
import { useContext, useEffect, useId, useRef } from 'react';
import { AtomicImage, AtomicVideo } from '@/components/atomic/atomic-media';
import { MediaLayoutContext } from '@/components/mdx/mdx-media';
import { CDN } from '@/lib/constants';

export interface MdxMediaItemProps {
	src: string;
	alt?: string;
}

const VIDEO_EXTENSIONS = ['.webm'];

function isVideo(filename: string): boolean {
	const lowercase = filename.toLowerCase();
	return VIDEO_EXTENSIONS.some((ext) => lowercase.includes(ext));
}

function getLoadedAspectRatio(
	element: HTMLImageElement | HTMLVideoElement,
	isVideoFile: boolean,
): number {
	if (isVideoFile) {
		const video = element as HTMLVideoElement;
		if (video.readyState >= 1 && video.videoWidth > 0) {
			return video.videoWidth / video.videoHeight;
		}
	} else {
		const img = element as HTMLImageElement;
		if (img.complete && img.naturalWidth > 0) {
			return img.naturalWidth / img.naturalHeight;
		}
	}
	return 0;
}

export function MdxMediaItem({ src, alt }: MdxMediaItemProps) {
	const id = useId();
	const context = useContext(MediaLayoutContext);
	const imageRef = useRef<HTMLImageElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const fullUrl = `${CDN.mediaUrl}${src}`;
	const isVideoFile = isVideo(src);

	const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
		const img = event.currentTarget;
		const aspectRatio = img.naturalWidth / img.naturalHeight;

		if (context && Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
	};

	const handleVideoMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
		const video = event.currentTarget;
		const aspectRatio = video.videoWidth / video.videoHeight;

		if (context && Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: context omitted to prevent infinite loops
	useEffect(() => {
		const element = isVideoFile ? videoRef.current : imageRef.current;
		if (!element || !context) return;

		const aspectRatio = getLoadedAspectRatio(element, isVideoFile);

		if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
			context.registerItem(id, aspectRatio);
		}
	}, [id, isVideoFile]);

	const handleViewportEnter = () => {
		if (!isVideoFile || !videoRef.current) return;

		const video = videoRef.current;

		// Only play if video is ready and not already playing
		if (video.readyState >= 2 && video.paused) {
			const playPromise = video.play();

			if (playPromise !== undefined) {
				playPromise.catch((error) => {
					// Autoplay blocked or interrupted - silent fail
					console.debug('Video play blocked:', src, error.name);
				});
			}
		}
	};

	const handleViewportLeave = () => {
		if (!isVideoFile || !videoRef.current) return;

		const video = videoRef.current;

		// Only pause if currently playing
		if (!video.paused) {
			video.pause();
		}
	};

	const flexBasis = context?.getFlexBasis(id) ?? '1';

	return (
		<motion.div
			style={{ flexBasis, flexShrink: 0 }}
			className="h-full"
			initial={{ opacity: 0 }}
			whileInView={{ opacity: 1 }}
			viewport={{ once: false, amount: 0.2 }}
			transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
			onViewportEnter={handleViewportEnter}
			onViewportLeave={handleViewportLeave}
		>
			{isVideoFile ? (
				<AtomicVideo
					videoRef={videoRef}
					src={fullUrl}
					onLoadedMetadata={handleVideoMetadata}
				/>
			) : (
				<AtomicImage
					imageRef={imageRef}
					src={fullUrl}
					alt={alt || ''}
					onLoad={handleImageLoad}
				/>
			)}
		</motion.div>
	);
}
