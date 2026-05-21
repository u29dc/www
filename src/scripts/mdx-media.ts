const VIDEO_SELECTOR = 'video[data-mdx-video]';
const IMAGE_SELECTOR = 'img.mdx-media__asset';
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const loadVideo = (video: HTMLVideoElement): void => {
	if (video.src) return;
	const source = video.dataset['src'];
	if (!source) return;
	video.src = source;
	video.load();
};

const shouldAutoplay = (video: HTMLVideoElement): boolean => video.dataset['autoplay'] === 'true' && !reduceMotionQuery.matches;

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
	const item = media.closest<HTMLElement>('.mdx-media__item');
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
	{ rootMargin: '240px 0px', threshold: 0.1 },
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
	for (const video of videos) {
		if (reduceMotionQuery.matches) {
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

document.addEventListener('astro:page-load', () => {
	observeVideos();
	observeImages();
});
