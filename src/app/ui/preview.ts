import { onNextFrame } from '../core/loop';
import { AppOwner, type Context } from '../core/owner';
import { setTimer, type TimerHandle } from '../core/timer';
import { MOTION } from '../core/tokens';
import { clamp } from '../utils/math';
import { canUseHoverVideo, getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../systems/device';
import { onRouteBeforeSwap, onRouteLoad } from '../systems/route';

type PreviewKind = 'image' | 'video';
type PreviewMode = 'artifact' | 'link';
type PreviewFit = 'cover' | 'contain';
type PreviewFlow = 'down' | 'up';

type PreviewConfig = {
	src: string;
	kind: PreviewKind;
	ratio: number;
	fit: PreviewFit;
	alt: string;
	mode: PreviewMode;
	posterSrc?: string;
};

type PreviewElements = {
	root: HTMLDivElement;
	card: HTMLDivElement;
	deck: HTMLDivElement;
};

type PreviewSlot = {
	key: string;
	root: HTMLDivElement;
	media: HTMLImageElement | HTMLVideoElement;
	config: PreviewConfig;
	kind: PreviewKind;
	ready: boolean;
	lastUsed: number;
	motionHandle?: TimerHandle;
	pauseHandle?: TimerHandle;
	poster?: HTMLImageElement;
};

type VideoFrameRequester = HTMLVideoElement & {
	requestVideoFrameCallback?: (callback: () => void) => number;
};

const TARGET_SELECTOR = '[data-hover-preview-target]';
const SCOPE_SELECTOR = '[data-hover-preview-scope]';
const REVEAL_SELECTOR = '[data-reveal]';
const ENABLE_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

class PreviewOwner extends AppOwner {
	readonly name = 'preview';
	override readonly order = 70;

	private readonly enableQuery = window.matchMedia(ENABLE_QUERY);
	private readonly reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
	private readonly slots = new Map<string, PreviewSlot>();
	private elements: PreviewElements | undefined;
	private activeTarget: HTMLElement | undefined;
	private activeScope: HTMLElement | undefined;
	private activeSlot: PreviewSlot | undefined;
	private activeMode: PreviewMode = 'link';
	private activeRatio = MOTION.preview.defaultRatio as number;
	private activeFlow: PreviewFlow = 'down';
	private recentTarget: HTMLElement | undefined;
	private recentTargetAt = 0;
	private hideHandle: TimerHandle | undefined;
	private pointerX = 0;
	private pointerY = 0;
	private currentX = 0;
	private currentY = 0;
	private targetX = 0;
	private targetY = 0;
	private width = MOTION.preview.defaultWidthPx as number;
	private height = MOTION.preview.defaultHeightPx as number;
	private hasPosition = false;
	private cardResizeObserver: ResizeObserver | undefined;
	private hasPrewarmedImages = false;
	private initialized = false;
	private positionActive = false;
	private shouldWritePosition = false;
	private shouldSleepAfterWrite = false;
	private wake: (reason?: string) => void = () => {};
	private sleep: () => void = () => {};

	override preinit(context: Context): void {
		super.preinit(context);
		this.wake = context.wake;
		this.sleep = context.sleep;
		this.bind();
	}

	init(): void {
		this.hasPrewarmedImages = false;
		this.prewarmImagePreviews();
	}

	update(): void {
		if (!this.positionActive) {
			this.sleep();
			return;
		}
		this.updatePosition();
	}

	write(): void {
		if (!this.shouldWritePosition) return;
		this.shouldWritePosition = false;
		this.applyPosition(this.currentX, this.currentY);
	}

	post(): void {
		if (!this.shouldSleepAfterWrite) return;
		this.shouldSleepAfterWrite = false;
		this.sleep();
	}

	override dispose(): void {
		super.dispose();
		this.disposePreviewElements();
		this.initialized = false;
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		window.addEventListener('resize', this.handleResize, { passive: true });
		this.addCleanup(() => window.removeEventListener('resize', this.handleResize));
		document.addEventListener('pointerover', this.handlePointerOver, { passive: true });
		this.addCleanup(() => document.removeEventListener('pointerover', this.handlePointerOver));
		document.addEventListener('pointermove', this.handlePointerMove, { passive: true });
		this.addCleanup(() => document.removeEventListener('pointermove', this.handlePointerMove));
		document.addEventListener('pointerout', this.handlePointerOut, { passive: true });
		this.addCleanup(() => document.removeEventListener('pointerout', this.handlePointerOut));
		document.addEventListener('visibilitychange', this.handleVisibilityChange);
		this.addCleanup(() => document.removeEventListener('visibilitychange', this.handleVisibilityChange));
		this.enableQuery.addEventListener('change', this.handleCapabilityChange);
		this.addCleanup(() => this.enableQuery.removeEventListener('change', this.handleCapabilityChange));
		this.reduceMotionQuery.addEventListener('change', this.handleMotionChange);
		this.addCleanup(() => this.reduceMotionQuery.removeEventListener('change', this.handleMotionChange));
		document.addEventListener('line-reveal-group-complete', this.prewarmImagePreviews);
		this.addCleanup(() => document.removeEventListener('line-reveal-group-complete', this.prewarmImagePreviews));
		this.addCleanup(
			onRouteLoad(() => {
				this.hasPrewarmedImages = false;
				this.prewarmImagePreviews();
			}),
		);
		this.addCleanup(onRouteBeforeSwap(() => this.disposePreviewElements()));
		this.addCleanup(subscribeDeviceProfile(this.handleDeviceProfileChange));
	}

	private isEnabled(): boolean {
		return this.enableQuery.matches;
	}

	private canPlayPreviewVideo(): boolean {
		return canUseHoverVideo(getDeviceProfile()) && !this.reduceMotionQuery.matches && !document.hidden;
	}

	private isRevealReady(target: HTMLElement): boolean {
		const gate = target.closest<HTMLElement>(REVEAL_SELECTOR);
		return !gate || gate.dataset['reveal'] === 'visible';
	}

	private readConfig(target: HTMLElement): PreviewConfig | undefined {
		const src = target.dataset['hoverPreviewSrc'];
		const kind = parseKind(target.dataset['hoverPreviewKind']);

		if (!src || !kind) return undefined;

		return {
			src,
			kind,
			ratio: parseRatio(target.dataset['hoverPreviewRatio']),
			fit: parseFit(target.dataset['hoverPreviewFit']),
			alt: target.dataset['hoverPreviewAlt'] ?? '',
			mode: parseMode(target.dataset['hoverPreviewTarget']),
			...(target.dataset['hoverPreviewPosterSrc'] ? { posterSrc: target.dataset['hoverPreviewPosterSrc'] } : {}),
		};
	}

	private clearHideHandle(): void {
		if (this.hideHandle === undefined) return;
		this.hideHandle.cancel();
		this.hideHandle = undefined;
	}

	private clearPauseHandle(slot: PreviewSlot): void {
		if (slot.pauseHandle === undefined) return;
		slot.pauseHandle.cancel();
		delete slot.pauseHandle;
	}

	private clearSlotMotionHandle(slot: PreviewSlot): void {
		if (slot.motionHandle === undefined) return;
		slot.motionHandle.cancel();
		delete slot.motionHandle;
	}

	private completeSlotMotionSoon(slot: PreviewSlot, expectedState: string, completeState: string): void {
		this.clearSlotMotionHandle(slot);
		slot.motionHandle = setTimer('preview.slot.complete', MOTION.preview.slotReelMs + MOTION.preview.slotReelBufferMs, () => {
			if (slot.root.dataset['state'] === expectedState) {
				if (completeState === 'idle') {
					this.resetSlotToIdle(slot, true);
				} else {
					slot.root.dataset['state'] = completeState;
				}
			}
			delete slot.motionHandle;
		});
	}

	private signedSlotOffset(direction: 1 | -1): string {
		const gap = MOTION.preview.slotGapPx;
		if (gap === 0) return `${direction * 100}%`;
		return `calc(${direction * 100}% + ${direction * gap}px)`;
	}

	private slotEnterOffset(flow: PreviewFlow): string {
		return this.signedSlotOffset(flow === 'down' ? 1 : -1);
	}

	private slotExitOffset(flow: PreviewFlow): string {
		return this.signedSlotOffset(flow === 'down' ? -1 : 1);
	}

	private setSlotOffset(slot: PreviewSlot, offset: string): void {
		slot.root.style.setProperty('--hover-preview-slot-y', offset);
	}

	private primeSlotOffset(slot: PreviewSlot, offset: string): void {
		slot.root.dataset['motion'] = 'instant';
		this.setSlotOffset(slot, offset);
		slot.root.getBoundingClientRect();
		delete slot.root.dataset['motion'];
	}

	private resetSlotToIdle(slot: PreviewSlot, instant: boolean): void {
		if (instant) {
			slot.root.dataset['motion'] = 'instant';
		}
		slot.root.dataset['state'] = 'idle';
		this.setSlotOffset(slot, '0%');
		if (!instant) return;

		slot.root.getBoundingClientRect();
		onNextFrame('preview.slot.instant', () => {
			if (slot.root.dataset['motion'] === 'instant') {
				delete slot.root.dataset['motion'];
			}
		});
	}

	private beginSlotEnter(slot: PreviewSlot, flow: PreviewFlow): void {
		this.clearSlotMotionHandle(slot);
		slot.root.dataset['flow'] = flow;

		if (this.reduceMotionQuery.matches) {
			slot.root.dataset['state'] = 'active';
			this.setSlotOffset(slot, '0%');
			return;
		}

		const slotState = slot.root.dataset['state'];
		if (slotState === 'idle') {
			slot.root.dataset['state'] = 'moving';
			this.primeSlotOffset(slot, this.slotEnterOffset(flow));
		} else {
			slot.root.dataset['state'] = 'moving';
		}

		this.setSlotOffset(slot, '0%');
		this.completeSlotMotionSoon(slot, 'moving', 'active');
	}

	private setSlotIdle(slot: PreviewSlot): void {
		this.clearSlotMotionHandle(slot);
		this.resetSlotToIdle(slot, false);
	}

	private beginSlotExit(slot: PreviewSlot, flow: PreviewFlow): void {
		if (slot.root.dataset['state'] === 'idle') return;

		this.clearSlotMotionHandle(slot);
		slot.root.dataset['flow'] = flow;

		if (this.reduceMotionQuery.matches) {
			this.setSlotIdle(slot);
			return;
		}

		slot.root.dataset['state'] = 'exiting';
		this.setSlotOffset(slot, this.slotExitOffset(flow));
		this.completeSlotMotionSoon(slot, 'exiting', 'idle');
	}

	private createPreviewElements(): PreviewElements {
		const root = document.createElement('div');
		root.dataset['hoverPreviewLayer'] = '';
		root.dataset['state'] = 'hidden';
		root.hidden = true;
		root.setAttribute('aria-hidden', 'true');

		const card = document.createElement('div');
		card.dataset['hoverPreviewCard'] = '';

		const deck = document.createElement('div');
		deck.dataset['hoverPreviewDeck'] = '';

		card.append(deck);
		root.append(card);
		document.body.append(root);

		if (typeof ResizeObserver !== 'undefined') {
			this.cardResizeObserver?.disconnect();
			this.cardResizeObserver = new ResizeObserver(([entry]) => {
				const rect = entry?.contentRect;
				if (!rect || rect.width <= 0 || rect.height <= 0) return;
				this.width = rect.width;
				this.height = rect.height;
				this.requestPositionFrame();
			});
			this.cardResizeObserver.observe(card);
		}

		return { root, card, deck };
	}

	private getPreviewElements(): PreviewElements {
		if (!this.elements || !this.elements.root.isConnected) {
			this.elements?.root.remove();
			this.elements = this.createPreviewElements();
		}
		return this.elements;
	}

	private isVideoSlot(slot: PreviewSlot): slot is PreviewSlot & { media: HTMLVideoElement } {
		return slot.kind === 'video' && slot.media instanceof HTMLVideoElement;
	}

	private markSlotReady(slot: PreviewSlot): void {
		slot.ready = true;
		slot.root.dataset['ready'] = 'true';
	}

	private createImageElement(config: PreviewConfig): HTMLImageElement {
		const image = document.createElement('img');
		image.dataset['hoverPreviewImage'] = '';
		image.dataset['hoverPreviewMedia'] = '';
		image.alt = config.alt;
		image.decoding = 'async';
		image.draggable = false;
		image.src = config.src;
		image.style.objectFit = config.fit;
		return image;
	}

	private createPosterElement(config: PreviewConfig): HTMLImageElement | undefined {
		if (!config.posterSrc) return undefined;

		const image = document.createElement('img');
		image.dataset['hoverPreviewPoster'] = '';
		image.dataset['hoverPreviewMedia'] = '';
		image.alt = '';
		image.decoding = 'async';
		image.draggable = false;
		image.src = config.posterSrc;
		image.style.objectFit = config.fit;
		return image;
	}

	private createVideoElement(config: PreviewConfig): HTMLVideoElement {
		const video = document.createElement('video');
		video.dataset['hoverPreviewVideo'] = '';
		video.dataset['hoverPreviewMedia'] = '';
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.preload = 'metadata';
		video.crossOrigin = 'anonymous';
		video.draggable = false;
		video.src = config.src;
		video.style.objectFit = config.fit;
		return video;
	}

	private slotKey(config: PreviewConfig): string {
		return [config.kind, config.src, config.ratio, config.fit, config.posterSrc ?? ''].join('|');
	}

	private updateSlotConfig(slot: PreviewSlot, config: PreviewConfig): void {
		slot.config = config;
		slot.root.dataset['kind'] = config.kind;
		slot.media.style.objectFit = config.fit;

		if (slot.media instanceof HTMLImageElement) {
			slot.media.alt = config.alt;
		}

		if (slot.poster) {
			slot.poster.style.objectFit = config.fit;
		}
	}

	private createSlot(config: PreviewConfig): PreviewSlot {
		const root = document.createElement('div');
		root.dataset['hoverPreviewSlot'] = '';
		root.dataset['state'] = 'idle';
		root.dataset['kind'] = config.kind;
		root.dataset['ready'] = config.kind === 'image' ? 'true' : 'false';

		const media = config.kind === 'image' ? this.createImageElement(config) : this.createVideoElement(config);
		const poster = config.kind === 'video' ? this.createPosterElement(config) : undefined;
		const slot: PreviewSlot = {
			key: this.slotKey(config),
			root,
			media,
			config,
			kind: config.kind,
			ready: config.kind === 'image',
			lastUsed: 0,
			...(poster ? { poster } : {}),
		};

		if (poster) root.append(poster);
		root.append(media);

		if (media instanceof HTMLImageElement) {
			media.addEventListener('load', () => this.markSlotReady(slot), { once: true });
			media.addEventListener('error', () => {
				root.dataset['mediaState'] = 'missing';
			});
			if (media.complete && media.naturalWidth > 0) this.markSlotReady(slot);
			void media
				.decode?.()
				.then(() => this.markSlotReady(slot))
				.catch(() => {});
		} else {
			media.addEventListener('loadeddata', () => this.markSlotReady(slot));
			media.addEventListener('canplay', () => this.markSlotReady(slot));
			media.addEventListener('error', () => {
				root.dataset['mediaState'] = 'missing';
			});
		}

		this.getPreviewElements().deck.append(root);
		this.slots.set(slot.key, slot);
		return slot;
	}

	private getSlot(config: PreviewConfig): PreviewSlot {
		const key = this.slotKey(config);
		const slot = this.slots.get(key) ?? this.createSlot(config);
		this.updateSlotConfig(slot, config);
		return slot;
	}

	private stopAnimation(): void {
		this.positionActive = false;
		this.shouldWritePosition = false;
		this.sleep();
	}

	private pauseVideoSlot(slot: PreviewSlot): void {
		if (!this.isVideoSlot(slot)) return;
		this.clearPauseHandle(slot);
		slot.media.pause();
	}

	private pauseVideoSlotSoon(slot: PreviewSlot): void {
		if (!this.isVideoSlot(slot)) return;
		this.clearPauseHandle(slot);
		slot.pauseHandle = setTimer('preview.video.pause', MOTION.preview.pauseDelayMs, () => {
			if (slot !== this.activeSlot) slot.media.pause();
			delete slot.pauseHandle;
		});
	}

	private pauseInactiveVideos(): void {
		for (const slot of this.slots.values()) {
			if (slot !== this.activeSlot) this.pauseVideoSlot(slot);
		}
	}

	private pauseAllVideos(): void {
		for (const slot of this.slots.values()) {
			this.pauseVideoSlot(slot);
		}
	}

	private playVideoSlot(slot: PreviewSlot): void {
		if (!this.isVideoSlot(slot) || !this.canPlayPreviewVideo()) return;

		this.clearPauseHandle(slot);
		if (!slot.ready) {
			const frameRequester = slot.media as VideoFrameRequester;
			frameRequester.requestVideoFrameCallback?.(() => this.markSlotReady(slot));
		}
		void slot.media.play().catch(() => {});
	}

	private removeSlot(slot: PreviewSlot): void {
		this.clearSlotMotionHandle(slot);
		this.pauseVideoSlot(slot);
		slot.root.remove();
		this.slots.delete(slot.key);
	}

	private videoSlotCount(): number {
		return Array.from(this.slots.values()).filter((slot) => this.isVideoSlot(slot)).length;
	}

	private enforceVideoCacheLimit(): void {
		const inactiveVideos = Array.from(this.slots.values())
			.filter((slot) => this.isVideoSlot(slot) && slot !== this.activeSlot)
			.toSorted((a, b) => a.lastUsed - b.lastUsed);

		while (this.videoSlotCount() > MOTION.preview.videoSlotLimit && inactiveVideos.length > 0) {
			const slot = inactiveVideos.shift();
			if (slot) this.removeSlot(slot);
		}
	}

	private recalculatePreviewSize(): void {
		const elements = this.elements;
		if (!elements || elements.root.hidden) return;

		const rect = elements.card.getBoundingClientRect();
		this.width = rect.width || this.width;
		this.height = rect.height || this.width / this.activeRatio;
	}

	private idle(callback: () => void): void {
		const win = window as Window & {
			requestIdleCallback?: (idleCallback: IdleRequestCallback, options?: IdleRequestOptions) => number;
		};
		if (typeof win.requestIdleCallback === 'function') {
			win.requestIdleCallback(callback, { timeout: 900 });
			return;
		}
		setTimer('preview.idle', 300, callback);
	}

	private readonly prewarmImagePreviews = (): void => {
		if (this.hasPrewarmedImages || document.hidden || this.reduceMotionQuery.matches) return;
		const profile = getDeviceProfile();
		if (profile.tier === 'low' || profile.networkProfile === 'save-data') return;

		const targets = Array.from(document.querySelectorAll<HTMLElement>(`${TARGET_SELECTOR}[data-hover-preview-kind="image"]`))
			.filter((target) => this.isRevealReady(target))
			.slice(0, 3);
		if (targets.length === 0) return;

		this.hasPrewarmedImages = true;
		this.idle(() => {
			for (const target of targets) {
				const src = target.dataset['hoverPreviewSrc'];
				if (!src) continue;
				const image = new Image();
				image.decoding = 'async';
				image.src = src;
				void image.decode?.().catch(() => {});
			}
		});
	};

	private updateTargetPosition(): void {
		const offsetX = this.activeMode === 'artifact' ? MOTION.preview.artifactOffsetX : MOTION.preview.linkOffsetX;
		const offsetY = this.activeMode === 'artifact' ? MOTION.preview.artifactOffsetY : MOTION.preview.linkOffsetY;

		let x = this.pointerX + offsetX;
		let y = this.pointerY - this.height - offsetY;

		if (x + this.width > window.innerWidth - MOTION.preview.edgeGapPx) {
			x = this.pointerX - this.width - offsetX;
		}
		if (y < MOTION.preview.edgeGapPx) {
			y = this.pointerY + offsetY;
		}

		this.targetX = clamp(x, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerWidth - this.width - MOTION.preview.edgeGapPx));
		this.targetY = clamp(y, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerHeight - this.height - MOTION.preview.edgeGapPx));
	}

	private applyPosition(x: number, y: number): void {
		if (!this.elements) return;
		this.elements.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
	}

	private updatePosition(): void {
		if (!this.activeTarget) {
			this.positionActive = false;
			this.shouldWritePosition = false;
			this.shouldSleepAfterWrite = true;
			return;
		}

		this.updateTargetPosition();

		if (!this.hasPosition || this.reduceMotionQuery.matches) {
			this.currentX = this.targetX;
			this.currentY = this.targetY;
			this.hasPosition = true;
		} else {
			const stiffness = this.activeMode === 'artifact' ? MOTION.preview.artifactStiffness : MOTION.preview.linkStiffness;
			this.currentX += (this.targetX - this.currentX) * stiffness;
			this.currentY += (this.targetY - this.currentY) * stiffness;
		}

		this.shouldWritePosition = true;

		const delta = Math.abs(this.currentX - this.targetX) + Math.abs(this.currentY - this.targetY);
		this.positionActive = delta > MOTION.preview.settleDeltaPx;
		if (!this.positionActive) {
			this.shouldSleepAfterWrite = true;
		}
	}

	private requestPositionFrame(): void {
		this.positionActive = true;
		this.shouldSleepAfterWrite = false;
		this.wake('preview:position');
	}

	private storePointer(event: PointerEvent): void {
		this.pointerX = event.clientX;
		this.pointerY = event.clientY;
		this.requestPositionFrame();
	}

	private clearActiveState(): void {
		if (this.activeTarget) {
			delete this.activeTarget.dataset['hoverPreviewActive'];
		}
		if (this.activeScope) {
			delete this.activeScope.dataset['hoverPreviewActive'];
		}
		this.activeTarget = undefined;
		this.activeScope = undefined;
		delete document.documentElement.dataset['hoverPreviewMode'];
	}

	private rememberRecentTarget(target: HTMLElement | undefined): void {
		if (!target) return;
		this.recentTarget = target;
		this.recentTargetAt = performance.now();
	}

	private recentDirectionTarget(): HTMLElement | undefined {
		if (!this.recentTarget || performance.now() - this.recentTargetAt > MOTION.preview.directionMemoryMs) {
			this.recentTarget = undefined;
			return undefined;
		}
		return this.recentTarget;
	}

	private directionBetweenTargets(previousTarget: HTMLElement | undefined, nextTarget: HTMLElement): PreviewFlow {
		if (!previousTarget || previousTarget === nextTarget || !previousTarget.isConnected || !nextTarget.isConnected) {
			return this.activeFlow;
		}

		const position = previousTarget.compareDocumentPosition(nextTarget);
		if (position & Node.DOCUMENT_POSITION_FOLLOWING) return 'down';
		if (position & Node.DOCUMENT_POSITION_PRECEDING) return 'up';
		return this.activeFlow;
	}

	private resolvePreviewFlow(target: HTMLElement, mode: PreviewMode): PreviewFlow {
		if (mode !== 'artifact') return 'down';
		return this.directionBetweenTargets(this.activeTarget ?? this.recentDirectionTarget(), target);
	}

	private setActiveSlot(slot: PreviewSlot, flow: PreviewFlow): void {
		this.activeFlow = flow;

		if (this.activeSlot === slot) {
			slot.lastUsed = performance.now();
			if (slot.root.dataset['state'] !== 'active' && slot.root.dataset['state'] !== 'moving') {
				this.beginSlotEnter(slot, flow);
			}
			if (this.isVideoSlot(slot) && slot.media.paused) this.playVideoSlot(slot);
			return;
		}

		if (this.activeSlot && this.activeSlot !== slot) {
			this.beginSlotExit(this.activeSlot, flow);
			this.pauseVideoSlotSoon(this.activeSlot);
		}

		this.activeSlot = slot;
		slot.lastUsed = performance.now();
		this.beginSlotEnter(slot, flow);

		if (this.isVideoSlot(slot)) {
			this.playVideoSlot(slot);
		}
	}

	private showPreview(target: HTMLElement, event: PointerEvent): void {
		if (!this.isEnabled()) return;
		if (!this.isRevealReady(target)) {
			this.hidePreview(target);
			return;
		}

		const config = this.readConfig(target);
		if (!config) return;

		const elements = this.getPreviewElements();
		this.clearHideHandle();
		const flow = this.resolvePreviewFlow(target, config.mode);

		if (this.activeTarget && this.activeTarget !== target) {
			delete this.activeTarget.dataset['hoverPreviewActive'];
		}
		if (this.activeScope && this.activeScope !== target.closest(SCOPE_SELECTOR)) {
			delete this.activeScope.dataset['hoverPreviewActive'];
		}

		this.activeTarget = target;
		this.activeScope = target.closest<HTMLElement>(SCOPE_SELECTOR) ?? undefined;
		this.activeMode = config.mode;
		this.activeRatio = config.ratio;
		target.dataset['hoverPreviewActive'] = 'true';
		if (this.activeScope) {
			this.activeScope.dataset['hoverPreviewActive'] = 'true';
		}
		document.documentElement.dataset['hoverPreviewMode'] = config.mode;

		elements.root.hidden = false;
		elements.root.dataset['state'] = 'visible';
		elements.root.dataset['mode'] = config.mode;
		elements.card.style.setProperty('--hover-preview-ratio', String(config.ratio));

		this.recalculatePreviewSize();
		this.setActiveSlot(this.getSlot(config), flow);
		this.storePointer(event);

		if (!this.hasPosition) {
			this.updateTargetPosition();
			this.currentX = this.targetX;
			this.currentY = this.targetY;
			this.hasPosition = true;
			this.applyPosition(this.currentX, this.currentY);
		}
	}

	private hidePreview(target?: HTMLElement): void {
		if (target && target !== this.activeTarget) return;

		this.rememberRecentTarget(this.activeTarget);
		this.clearActiveState();
		this.hasPosition = false;
		this.stopAnimation();

		if (this.activeSlot) {
			this.beginSlotExit(this.activeSlot, this.activeFlow);
			this.pauseVideoSlotSoon(this.activeSlot);
			this.activeSlot = undefined;
		}

		const elements = this.elements;
		if (!elements) return;

		elements.root.dataset['state'] = 'hiding';

		this.clearHideHandle();
		this.hideHandle = setTimer('preview.hide', MOTION.preview.hideDelayMs, () => {
			if (this.activeTarget) return;
			elements.root.dataset['state'] = 'hidden';
			elements.root.hidden = true;
			this.recentTarget = undefined;
			this.activeFlow = 'down';
			this.enforceVideoCacheLimit();
		});
	}

	private disposePreviewElements(): void {
		this.clearActiveState();
		this.hasPosition = false;
		this.stopAnimation();
		this.clearHideHandle();

		for (const slot of this.slots.values()) {
			this.clearSlotMotionHandle(slot);
			this.pauseVideoSlot(slot);
			slot.root.remove();
		}
		this.slots.clear();
		this.activeSlot = undefined;
		this.recentTarget = undefined;
		this.activeFlow = 'down';
		this.cardResizeObserver?.disconnect();
		this.cardResizeObserver = undefined;

		this.elements?.root.remove();
		this.elements = undefined;
	}

	private targetFromEvent(event: Event): HTMLElement | undefined {
		if (!(event.target instanceof Element)) return undefined;
		const target = event.target.closest<HTMLElement>(TARGET_SELECTOR);
		if (!target || !this.isRevealReady(target)) return undefined;
		return target;
	}

	private readonly handlePointerOver = (event: PointerEvent): void => {
		const target = this.targetFromEvent(event);
		if (!target) return;
		if (target === this.activeTarget) {
			this.storePointer(event);
			return;
		}

		this.showPreview(target, event);
	};

	private readonly handlePointerMove = (event: PointerEvent): void => {
		const target = this.targetFromEvent(event);
		if (this.activeTarget && !this.isRevealReady(this.activeTarget)) {
			this.hidePreview(this.activeTarget);
			return;
		}
		if (target && target !== this.activeTarget) {
			this.showPreview(target, event);
			return;
		}
		if (!this.activeTarget || target !== this.activeTarget) return;
		this.storePointer(event);
	};

	private readonly handlePointerOut = (event: PointerEvent): void => {
		if (!this.activeTarget) return;
		if (!this.isRevealReady(this.activeTarget)) {
			this.hidePreview(this.activeTarget);
			return;
		}
		const relatedTarget = event.relatedTarget;

		if (relatedTarget instanceof Node && this.activeTarget.contains(relatedTarget)) return;
		const nextTarget = relatedTarget instanceof Element ? relatedTarget.closest<HTMLElement>(TARGET_SELECTOR) : undefined;
		if (nextTarget === this.activeTarget) return;
		if (nextTarget && this.isRevealReady(nextTarget)) return;

		this.hidePreview(this.activeTarget);
	};

	private readonly handleResize = (): void => {
		this.recalculatePreviewSize();
		this.requestPositionFrame();
	};

	private readonly handleVisibilityChange = (): void => {
		if (document.hidden) this.pauseAllVideos();
	};

	private readonly handleCapabilityChange = (): void => {
		if (!this.isEnabled()) {
			this.hidePreview();
			return;
		}
	};

	private readonly handleMotionChange = (): void => {
		if (this.reduceMotionQuery.matches) {
			this.pauseInactiveVideos();
			if (this.activeSlot) this.pauseVideoSlot(this.activeSlot);
			return;
		}
		if (this.activeSlot) this.playVideoSlot(this.activeSlot);
		this.requestPositionFrame();
	};

	private readonly handleDeviceProfileChange = (): void => {
		if (!this.canPlayPreviewVideo()) {
			this.pauseAllVideos();
		}
		this.prewarmImagePreviews();
	};
}

const parseKind = (value: string | undefined): PreviewKind | undefined => {
	if (value === 'image' || value === 'video') return value;
	return undefined;
};

const parseMode = (value: string | undefined): PreviewMode => (value === 'artifact' ? 'artifact' : 'link');

const parseFit = (value: string | undefined): PreviewFit => (value === 'contain' ? 'contain' : 'cover');

const parseRatio = (value: string | undefined): number => {
	const ratio = Number.parseFloat(value ?? '');
	return Number.isFinite(ratio) && ratio > 0 ? ratio : MOTION.preview.defaultRatio;
};

export const preview = new PreviewOwner();
