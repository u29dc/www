import { BaseModule, type Context } from '../core/module';
import { MOTION } from '../core/tokens';
import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../systems/device';
import { onRouteBeforeSwap } from '../systems/route';

const VIDEO_SELECTOR = 'video[data-media-video]';
const IMAGE_SELECTOR = 'img[data-media-asset]';

type VideoState = {
	intersecting: boolean;
	userPaused: boolean;
	playing: boolean;
	pendingPauses: number;
	resume: boolean;
	cleanup: () => void;
};

class MediaOwner extends BaseModule {
	readonly name = 'media';

	private initialized = false;
	private readonly videos = new Map<HTMLVideoElement, VideoState>();
	private readonly images = new Map<HTMLImageElement, () => void>();
	private observer: IntersectionObserver | undefined;
	private pageHidden = false;

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
		this.observer?.disconnect();
		this.observer = undefined;
		this.initialized = false;
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		this.addCleanup(subscribeDeviceProfile(this.handleMotionChange));
		this.addCleanup(onRouteBeforeSwap(() => this.cleanupMedia()));
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		window.addEventListener('pagehide', this.handlePageHide);
		window.addEventListener('pageshow', this.handlePageShow);
		this.addCleanup(() => document.removeEventListener('visibilitychange', this.handleVisibilityChange));
		this.addCleanup(() => window.removeEventListener('pagehide', this.handlePageHide));
		this.addCleanup(() => window.removeEventListener('pageshow', this.handlePageShow));
	}

	private ensureObserver(): IntersectionObserver {
		this.observer ??= new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!(entry.target instanceof HTMLVideoElement)) continue;
					const state = this.videos.get(entry.target);
					if (!state) continue;
					state.intersecting = entry.isIntersecting;
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
		const state = this.videos.get(video);
		if (!state || !state.intersecting || document.hidden || this.pageHidden || state.userPaused || video.hidden) return;
		// Native controls update paused before dispatching their pause event.
		if (video.paused && state.playing) {
			state.userPaused = true;
			state.playing = false;
			state.resume = false;
			return;
		}
		this.loadVideo(video);
		if (!this.shouldAutoplay(video) && !state.resume) {
			return;
		}
		state.resume = false;
		state.playing = true;
		void video.play().catch(() => {
			if (!this.videos.has(video)) return;
			if (video.paused) state.playing = false;
		});
	}

	private pauseVideo(video: HTMLVideoElement): void {
		const state = this.videos.get(video);
		if (!state || video.paused) return;
		state.playing = false;
		state.resume = !state.userPaused;
		state.pendingPauses += 1;
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
			const state: VideoState = { intersecting: false, userPaused: false, playing: false, pendingPauses: 0, resume: false, cleanup: () => {} };
			const handlePause = (): void => {
				if (state.pendingPauses > 0) {
					state.pendingPauses -= 1;
					return;
				}
				state.userPaused = true;
				state.playing = false;
				state.resume = false;
			};
			const handlePlay = (): void => {
				if (video.paused) return;
				state.userPaused = false;
				state.playing = true;
				if (document.hidden || this.pageHidden || !state.intersecting) this.pauseVideo(video);
			};
			const handleError = (): void => this.markMediaError(video);
			video.addEventListener('pause', handlePause);
			video.addEventListener('play', handlePlay);
			video.addEventListener('error', handleError);
			state.cleanup = (): void => {
				video.removeEventListener('pause', handlePause);
				video.removeEventListener('play', handlePlay);
				video.removeEventListener('error', handleError);
			};
			this.videos.set(video, state);
			observer.observe(video);
		}
	}

	private observeImages(): void {
		for (const image of document.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR)) {
			if (this.images.has(image)) continue;
			const handleError = (): void => this.markMediaError(image);
			this.images.set(image, () => image.removeEventListener('error', handleError));
			image.addEventListener('error', handleError, { once: true });
			if (image.complete && image.naturalWidth === 0) this.markMediaError(image);
		}
	}

	private cleanupMedia(): void {
		for (const [video, state] of this.videos) {
			state.cleanup();
			video.pause();
			video.removeAttribute('src');
			video.load();
			this.observer?.unobserve(video);
		}
		for (const cleanup of this.images.values()) cleanup();
		this.videos.clear();
		this.images.clear();
	}

	private readonly handleMotionChange = (): void => {
		const profile = getDeviceProfile();
		const shouldStopMotion = profile.motionQuality === 'reduced' || profile.networkProfile === 'save-data';

		for (const [video, state] of this.videos) {
			if (shouldStopMotion) {
				this.pauseVideo(video);
				state.resume = false;
				continue;
			}
			this.playVideo(video);
		}
	};

	private suspendVideos(): void {
		for (const video of this.videos.keys()) this.pauseVideo(video);
	}

	private readonly handleVisibilityChange = (): void => {
		if (document.hidden) {
			this.suspendVideos();
			return;
		}
		for (const video of this.videos.keys()) this.playVideo(video);
	};

	private readonly handlePageHide = (): void => {
		this.pageHidden = true;
		this.suspendVideos();
	};

	private readonly handlePageShow = (): void => {
		this.pageHidden = false;
		this.handleVisibilityChange();
	};
}

export const media = new MediaOwner();
