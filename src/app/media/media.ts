import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../device/device';
import { MOTION } from '../motion/tokens';
import { onRouteBeforeSwap, onRouteLoad } from '../route/route';
import { createTask } from '../runtime/task';

type MediaState = {
	initialized: boolean;
	videos: Set<HTMLVideoElement>;
	images: Set<HTMLImageElement>;
	observer?: IntersectionObserver;
	reduceMotionQuery: MediaQueryList;
	cleanups: Array<() => void>;
};

const VIDEO_SELECTOR = 'video[data-media-video]';
const IMAGE_SELECTOR = 'img[data-media-asset]';

const state: MediaState = {
	initialized: false,
	videos: new Set(),
	images: new Set(),
	reduceMotionQuery: window.matchMedia('(prefers-reduced-motion: reduce)'),
	cleanups: [],
};

export const media = createTask({
	name: 'media',
	order: 60,
	state,
	preinit() {
		bindMedia();
	},
	init() {
		observeVideos();
		observeImages();
	},
	dispose() {
		for (const cleanup of state.cleanups.splice(0)) cleanup();
		cleanupMedia();
	},
});

const ensureObserver = (): IntersectionObserver => {
	state.observer ??= new IntersectionObserver(
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
	return state.observer;
};

const loadVideo = (video: HTMLVideoElement): void => {
	if (video.src) return;
	const source = video.dataset['src'];
	if (!source) return;
	video.src = source;
	video.load();
};

const shouldAutoplay = (video: HTMLVideoElement): boolean => {
	const profile = getDeviceProfile();
	return video.dataset['autoplay'] === 'true' && profile.motionQuality !== 'reduced' && profile.networkProfile !== 'save-data' && !state.reduceMotionQuery.matches;
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

const markMediaError = (element: HTMLImageElement | HTMLVideoElement): void => {
	const item = element.closest<HTMLElement>('[data-media-item]');
	if (!item) return;
	item.dataset['mediaState'] = 'missing';
	element.hidden = true;
};

const observeVideos = (): void => {
	const observer = ensureObserver();
	for (const video of document.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR)) {
		if (state.videos.has(video)) continue;
		state.videos.add(video);
		video.addEventListener('error', () => markMediaError(video), { once: true });
		observer.observe(video);
	}
};

const observeImages = (): void => {
	for (const image of document.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)) {
		if (state.images.has(image)) continue;
		state.images.add(image);
		image.addEventListener('error', () => markMediaError(image), { once: true });
		if (image.complete && image.naturalWidth === 0) markMediaError(image);
	}
};

const cleanupMedia = (): void => {
	for (const video of state.videos) {
		pauseVideo(video);
		state.observer?.unobserve(video);
	}
	state.videos.clear();
	state.images.clear();
};

const handleMotionChange = (): void => {
	const profile = getDeviceProfile();
	const shouldStopMotion = state.reduceMotionQuery.matches || profile.motionQuality === 'reduced' || profile.networkProfile === 'save-data';

	for (const video of state.videos) {
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

const addCleanup = (cleanup: () => void): void => {
	state.cleanups.push(cleanup);
};

const bindMedia = (): void => {
	if (state.initialized) return;
	state.initialized = true;

	initDeviceProfile();
	state.reduceMotionQuery.addEventListener('change', handleMotionChange);
	addCleanup(() => state.reduceMotionQuery.removeEventListener('change', handleMotionChange));
	addCleanup(subscribeDeviceProfile(handleMotionChange));
	addCleanup(onRouteBeforeSwap(cleanupMedia));
	addCleanup(
		onRouteLoad(() => {
			observeVideos();
			observeImages();
		}),
	);
};
