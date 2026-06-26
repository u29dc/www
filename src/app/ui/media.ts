import { BaseModule, type Context } from '../core/module';
import { MOTION } from '../core/tokens';
import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../systems/device';
import { onRouteBeforeSwap } from '../systems/route';

const VIDEO_SELECTOR = 'video[data-media-video]';
const IMAGE_SELECTOR = 'img[data-media-asset]';

class MediaOwner extends BaseModule {
	readonly name = 'media';

	private initialized = false;
	private readonly videos = new Set<HTMLVideoElement>();
	private readonly images = new Set<HTMLImageElement>();
	private observer: IntersectionObserver | undefined;

	override preinit(context: Context): void {
		super.preinit(context);
		this.bind();
	}

	override init(): void {
		this.observeVideos();
		this.observeImages();
	}

	override refresh(): void {
		this.observeVideos();
		this.observeImages();
	}

	override dispose(): void {
		super.dispose();
		this.cleanupMedia();
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		this.addCleanup(subscribeDeviceProfile(this.handleMotionChange));
		this.addCleanup(onRouteBeforeSwap(() => this.cleanupMedia()));
	}

	private ensureObserver(): IntersectionObserver {
		this.observer ??= new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!(entry.target instanceof HTMLVideoElement)) continue;
					if (entry.isIntersecting) {
						this.playVideo(entry.target);
					} else {
						this.pauseVideo(entry.target);
					}
				}
			},
			{ rootMargin: MOTION.media.rootMargin, threshold: MOTION.media.threshold },
		);
		return this.observer;
	}

	private loadVideo(video: HTMLVideoElement): void {
		if (video.src) return;
		const source = video.dataset['src'];
		if (!source) return;
		video.src = source;
		video.load();
	}

	private shouldAutoplay(video: HTMLVideoElement): boolean {
		const profile = getDeviceProfile();
		return video.dataset['autoplay'] === 'true' && profile.motionQuality !== 'reduced' && profile.networkProfile !== 'save-data';
	}

	private playVideo(video: HTMLVideoElement): void {
		this.loadVideo(video);
		if (!this.shouldAutoplay(video)) {
			video.controls = true;
			return;
		}
		video.play().catch(() => {
			video.controls = true;
		});
	}

	private pauseVideo(video: HTMLVideoElement): void {
		video.pause();
	}

	private markMediaError(element: HTMLImageElement | HTMLVideoElement): void {
		const item = element.closest<HTMLElement>('[data-media-item]');
		if (!item) return;
		item.dataset['mediaState'] = 'missing';
		element.hidden = true;
	}

	private observeVideos(): void {
		const observer = this.ensureObserver();
		for (const video of document.querySelectorAll<HTMLVideoElement>(VIDEO_SELECTOR)) {
			if (this.videos.has(video)) continue;
			this.videos.add(video);
			video.addEventListener('error', () => this.markMediaError(video), { once: true });
			observer.observe(video);
		}
	}

	private observeImages(): void {
		for (const image of document.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)) {
			if (this.images.has(image)) continue;
			this.images.add(image);
			image.addEventListener('error', () => this.markMediaError(image), { once: true });
			if (image.complete && image.naturalWidth === 0) this.markMediaError(image);
		}
	}

	private cleanupMedia(): void {
		for (const video of this.videos) {
			this.pauseVideo(video);
			this.observer?.unobserve(video);
		}
		this.videos.clear();
		this.images.clear();
	}

	private readonly handleMotionChange = (): void => {
		const profile = getDeviceProfile();
		const shouldStopMotion = profile.motionQuality === 'reduced' || profile.networkProfile === 'save-data';

		for (const video of this.videos) {
			if (shouldStopMotion) {
				video.controls = true;
				this.pauseVideo(video);
				continue;
			}
			const rect = video.getBoundingClientRect();
			if (rect.top < window.innerHeight && rect.bottom > 0) {
				this.playVideo(video);
			}
		}
	};
}

export const media = new MediaOwner();
