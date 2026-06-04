import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../lib/device';
import { MOTION } from '../lib/motion';

const VIDEO_SELECTOR = 'video[data-media-video]';
const IMAGE_SELECTOR = 'img[data-media-asset]';
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
initDeviceProfile();

const loadVideo = (video: HTMLVideoElement): void => {
	if (video.src) return;
	const source = video.dataset['src'];
	if (!source) return;
	video.src = source;
	video.load();
};

const shouldAutoplay = (video: HTMLVideoElement): boolean => {
	const profile = getDeviceProfile();
	return video.dataset['autoplay'] === 'true' && profile.motionQuality !== 'reduced' && profile.networkProfile !== 'save-data' && !reduceMotionQuery.matches;
};

const playVideo = (video: HTMLVideoElement): void => {
	loadVideo(video);
	if (!shouldAutoplay(video)) {
		video.controls = true;
		return;
	}
	video.play().catch(() => {
		video.controls = true;
	});
};

const pauseVideo = (video: HTMLVideoElement): void => {
	video.pause();
};

const videos = new Set<HTMLVideoElement>();
const images = new Set<HTMLImageElement>();

const markMediaError = (media: HTMLImageElement | HTMLVideoElement): void => {
	const item = media.closest<HTMLElement>('[data-media-item]');
	if (!item) return;
	item.dataset['mediaState'] = 'missing';
	media.hidden = true;
};

const observer = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (!(entry.target instanceof HTMLVideoElement)) continue;
			if (entry.isIntersecting) {
				playVideo(entry.target);
			} else {
				pauseVideo(entry.target);
			}
		}
	},
	{ rootMargin: MOTION.media.rootMargin, threshold: MOTION.media.threshold },
);

const observeVideos = (): void => {
	for (const video of document.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR)) {
		if (videos.has(video)) continue;
		videos.add(video);
		video.addEventListener('error', () => markMediaError(video), { once: true });
		observer.observe(video);
	}
};

const observeImages = (): void => {
	for (const image of document.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)) {
		if (images.has(image)) continue;
		images.add(image);
		image.addEventListener('error', () => markMediaError(image), { once: true });
		if (image.complete && image.naturalWidth === 0) markMediaError(image);
	}
};

const handleMotionChange = (): void => {
	const profile = getDeviceProfile();
	const shouldStopMotion = reduceMotionQuery.matches || profile.motionQuality === 'reduced' || profile.networkProfile === 'save-data';

	for (const video of videos) {
		if (shouldStopMotion) {
			video.controls = true;
			pauseVideo(video);
			continue;
		}
		const rect = video.getBoundingClientRect();
		if (rect.top < window.innerHeight && rect.bottom > 0) {
			playVideo(video);
		}
	}
};

observeVideos();
observeImages();
reduceMotionQuery.addEventListener('change', handleMotionChange);
subscribeDeviceProfile(handleMotionChange);

document.addEventListener('astro:page-load', () => {
	observeVideos();
	observeImages();
});
