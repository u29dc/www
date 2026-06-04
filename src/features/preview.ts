import { canUseHoverVideo, getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../lib/device';
import { MOTION } from '../lib/motion';

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
	motionHandle?: number;
	pauseHandle?: number;
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

const enableQuery = window.matchMedia(ENABLE_QUERY);
const reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
initDeviceProfile();
const slots = new Map<string, PreviewSlot>();

let previewElements: PreviewElements | undefined;
let activeTarget: HTMLElement | undefined;
let activeScope: HTMLElement | undefined;
let activeSlot: PreviewSlot | undefined;
let activeMode: PreviewMode = 'link';
let activeRatio: number = MOTION.preview.defaultRatio;
let activeFlow: PreviewFlow = 'down';
let recentTarget: HTMLElement | undefined;
let recentTargetAt = 0;
let hideHandle: number | undefined;
let animationFrame = 0;
let pointerX = 0;
let pointerY = 0;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
let previewWidth: number = MOTION.preview.defaultWidthPx;
let previewHeight: number = MOTION.preview.defaultHeightPx;
let hasPosition = false;
let cardResizeObserver: ResizeObserver | undefined;
let hasPrewarmedImages = false;

const isEnabled = (): boolean => enableQuery.matches;

const canPlayPreviewVideo = (): boolean => canUseHoverVideo(getDeviceProfile()) && !reduceMotionQuery.matches && !document.hidden;

const isRevealReady = (target: HTMLElement): boolean => {
	const gate = target.closest<HTMLElement>(REVEAL_SELECTOR);
	return !gate || gate.dataset['reveal'] === 'visible';
};

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

const readConfig = (target: HTMLElement): PreviewConfig | undefined => {
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
};

const clearHideHandle = (): void => {
	if (hideHandle === undefined) return;
	window.clearTimeout(hideHandle);
	hideHandle = undefined;
};

const clearPauseHandle = (slot: PreviewSlot): void => {
	if (slot.pauseHandle === undefined) return;
	window.clearTimeout(slot.pauseHandle);
	delete slot.pauseHandle;
};

const clearSlotMotionHandle = (slot: PreviewSlot): void => {
	if (slot.motionHandle === undefined) return;
	window.clearTimeout(slot.motionHandle);
	delete slot.motionHandle;
};

const completeSlotMotionSoon = (slot: PreviewSlot, expectedState: string, completeState: string): void => {
	clearSlotMotionHandle(slot);
	slot.motionHandle = window.setTimeout(() => {
		if (slot.root.dataset['state'] === expectedState) {
			if (completeState === 'idle') {
				resetSlotToIdle(slot, true);
			} else {
				slot.root.dataset['state'] = completeState;
			}
		}
		delete slot.motionHandle;
	}, MOTION.preview.slotReelMs + MOTION.preview.slotReelBufferMs);
};

const signedSlotOffset = (direction: 1 | -1): string => {
	const gap = MOTION.preview.slotGapPx;
	if (gap === 0) return `${direction * 100}%`;
	return `calc(${direction * 100}% + ${direction * gap}px)`;
};

const slotEnterOffset = (flow: PreviewFlow): string => signedSlotOffset(flow === 'down' ? 1 : -1);

const slotExitOffset = (flow: PreviewFlow): string => signedSlotOffset(flow === 'down' ? -1 : 1);

const setSlotOffset = (slot: PreviewSlot, offset: string): void => {
	slot.root.style.setProperty('--hover-preview-slot-y', offset);
};

const primeSlotOffset = (slot: PreviewSlot, offset: string): void => {
	slot.root.dataset['motion'] = 'instant';
	setSlotOffset(slot, offset);
	slot.root.getBoundingClientRect();
	delete slot.root.dataset['motion'];
};

const resetSlotToIdle = (slot: PreviewSlot, instant: boolean): void => {
	if (instant) {
		slot.root.dataset['motion'] = 'instant';
	}
	slot.root.dataset['state'] = 'idle';
	setSlotOffset(slot, '0%');
	if (!instant) return;

	slot.root.getBoundingClientRect();
	requestAnimationFrame(() => {
		if (slot.root.dataset['motion'] === 'instant') {
			delete slot.root.dataset['motion'];
		}
	});
};

const beginSlotEnter = (slot: PreviewSlot, flow: PreviewFlow): void => {
	clearSlotMotionHandle(slot);
	slot.root.dataset['flow'] = flow;

	if (reduceMotionQuery.matches) {
		slot.root.dataset['state'] = 'active';
		setSlotOffset(slot, '0%');
		return;
	}

	const state = slot.root.dataset['state'];
	if (state === 'idle') {
		slot.root.dataset['state'] = 'moving';
		primeSlotOffset(slot, slotEnterOffset(flow));
	} else {
		slot.root.dataset['state'] = 'moving';
	}

	setSlotOffset(slot, '0%');
	completeSlotMotionSoon(slot, 'moving', 'active');
};

const setSlotIdle = (slot: PreviewSlot): void => {
	clearSlotMotionHandle(slot);
	resetSlotToIdle(slot, false);
};

const beginSlotExit = (slot: PreviewSlot, flow: PreviewFlow): void => {
	if (slot.root.dataset['state'] === 'idle') return;

	clearSlotMotionHandle(slot);
	slot.root.dataset['flow'] = flow;

	if (reduceMotionQuery.matches) {
		setSlotIdle(slot);
		return;
	}

	slot.root.dataset['state'] = 'exiting';
	setSlotOffset(slot, slotExitOffset(flow));
	completeSlotMotionSoon(slot, 'exiting', 'idle');
};

const createPreviewElements = (): PreviewElements => {
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
		cardResizeObserver?.disconnect();
		cardResizeObserver = new ResizeObserver(([entry]) => {
			const rect = entry?.contentRect;
			if (!rect || rect.width <= 0 || rect.height <= 0) return;
			previewWidth = rect.width;
			previewHeight = rect.height;
			requestPositionFrame();
		});
		cardResizeObserver.observe(card);
	}

	return { root, card, deck };
};

const getPreviewElements = (): PreviewElements => {
	if (!previewElements || !previewElements.root.isConnected) {
		previewElements?.root.remove();
		previewElements = createPreviewElements();
	}
	return previewElements;
};

const isVideoSlot = (slot: PreviewSlot): slot is PreviewSlot & { media: HTMLVideoElement } => slot.kind === 'video' && slot.media instanceof HTMLVideoElement;

const markSlotReady = (slot: PreviewSlot): void => {
	slot.ready = true;
	slot.root.dataset['ready'] = 'true';
};

const createImageElement = (config: PreviewConfig): HTMLImageElement => {
	const image = document.createElement('img');
	image.dataset['hoverPreviewImage'] = '';
	image.dataset['hoverPreviewMedia'] = '';
	image.alt = config.alt;
	image.decoding = 'async';
	image.draggable = false;
	image.src = config.src;
	image.style.objectFit = config.fit;
	return image;
};

const createPosterElement = (config: PreviewConfig): HTMLImageElement | undefined => {
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
};

const createVideoElement = (config: PreviewConfig): HTMLVideoElement => {
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
};

const slotKey = (config: PreviewConfig): string => [config.kind, config.src, config.ratio, config.fit, config.posterSrc ?? ''].join('|');

const updateSlotConfig = (slot: PreviewSlot, config: PreviewConfig): void => {
	slot.config = config;
	slot.root.dataset['kind'] = config.kind;
	slot.media.style.objectFit = config.fit;

	if (slot.media instanceof HTMLImageElement) {
		slot.media.alt = config.alt;
	}

	if (slot.poster) {
		slot.poster.style.objectFit = config.fit;
	}
};

const createSlot = (config: PreviewConfig): PreviewSlot => {
	const root = document.createElement('div');
	root.dataset['hoverPreviewSlot'] = '';
	root.dataset['state'] = 'idle';
	root.dataset['kind'] = config.kind;
	root.dataset['ready'] = config.kind === 'image' ? 'true' : 'false';

	const media = config.kind === 'image' ? createImageElement(config) : createVideoElement(config);
	const poster = config.kind === 'video' ? createPosterElement(config) : undefined;
	const slot: PreviewSlot = {
		key: slotKey(config),
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
		media.addEventListener('load', () => markSlotReady(slot), { once: true });
		media.addEventListener('error', () => {
			root.dataset['mediaState'] = 'missing';
		});
		if (media.complete && media.naturalWidth > 0) markSlotReady(slot);
		void media
			.decode?.()
			.then(() => markSlotReady(slot))
			.catch(() => {});
	} else {
		media.addEventListener('loadeddata', () => markSlotReady(slot));
		media.addEventListener('canplay', () => markSlotReady(slot));
		media.addEventListener('error', () => {
			root.dataset['mediaState'] = 'missing';
		});
	}

	getPreviewElements().deck.append(root);
	slots.set(slot.key, slot);
	return slot;
};

const getSlot = (config: PreviewConfig): PreviewSlot => {
	const key = slotKey(config);
	const slot = slots.get(key) ?? createSlot(config);
	updateSlotConfig(slot, config);
	return slot;
};

const stopAnimation = (): void => {
	if (animationFrame === 0) return;
	cancelAnimationFrame(animationFrame);
	animationFrame = 0;
};

const pauseVideoSlot = (slot: PreviewSlot): void => {
	if (!isVideoSlot(slot)) return;
	clearPauseHandle(slot);
	slot.media.pause();
};

const pauseVideoSlotSoon = (slot: PreviewSlot): void => {
	if (!isVideoSlot(slot)) return;
	clearPauseHandle(slot);
	slot.pauseHandle = window.setTimeout(() => {
		if (slot !== activeSlot) slot.media.pause();
		delete slot.pauseHandle;
	}, MOTION.preview.pauseDelayMs);
};

const pauseInactiveVideos = (): void => {
	for (const slot of slots.values()) {
		if (slot !== activeSlot) pauseVideoSlot(slot);
	}
};

const pauseAllVideos = (): void => {
	for (const slot of slots.values()) {
		pauseVideoSlot(slot);
	}
};

const playVideoSlot = (slot: PreviewSlot): void => {
	if (!isVideoSlot(slot) || !canPlayPreviewVideo()) return;

	clearPauseHandle(slot);
	if (!slot.ready) {
		const frameRequester = slot.media as VideoFrameRequester;
		frameRequester.requestVideoFrameCallback?.(() => markSlotReady(slot));
	}
	void slot.media.play().catch(() => {});
};

const removeSlot = (slot: PreviewSlot): void => {
	clearSlotMotionHandle(slot);
	pauseVideoSlot(slot);
	slot.root.remove();
	slots.delete(slot.key);
};

const videoSlotCount = (): number => Array.from(slots.values()).filter(isVideoSlot).length;

const enforceVideoCacheLimit = (): void => {
	const inactiveVideos = Array.from(slots.values())
		.filter((slot) => isVideoSlot(slot) && slot !== activeSlot)
		.toSorted((a, b) => a.lastUsed - b.lastUsed);

	while (videoSlotCount() > MOTION.preview.videoSlotLimit && inactiveVideos.length > 0) {
		const slot = inactiveVideos.shift();
		if (slot) removeSlot(slot);
	}
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const recalculatePreviewSize = (): void => {
	const elements = previewElements;
	if (!elements || elements.root.hidden) return;

	const rect = elements.card.getBoundingClientRect();
	previewWidth = rect.width || previewWidth;
	previewHeight = rect.height || previewWidth / activeRatio;
};

const idle = (callback: () => void): void => {
	const win = window as Window & {
		requestIdleCallback?: (idleCallback: IdleRequestCallback, options?: IdleRequestOptions) => number;
	};
	if (typeof win.requestIdleCallback === 'function') {
		win.requestIdleCallback(callback, { timeout: 900 });
		return;
	}
	window.setTimeout(callback, 300);
};

const prewarmImagePreviews = (): void => {
	if (hasPrewarmedImages || document.hidden || reduceMotionQuery.matches) return;
	const profile = getDeviceProfile();
	if (profile.tier === 'low' || profile.networkProfile === 'save-data') return;

	const targets = Array.from(document.querySelectorAll<HTMLElement>(`${TARGET_SELECTOR}[data-hover-preview-kind="image"]`))
		.filter(isRevealReady)
		.slice(0, 3);
	if (targets.length === 0) return;

	hasPrewarmedImages = true;
	idle(() => {
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

const updateTargetPosition = (): void => {
	const offsetX = activeMode === 'artifact' ? MOTION.preview.artifactOffsetX : MOTION.preview.linkOffsetX;
	const offsetY = activeMode === 'artifact' ? MOTION.preview.artifactOffsetY : MOTION.preview.linkOffsetY;

	let x = pointerX + offsetX;
	let y = pointerY - previewHeight - offsetY;

	if (x + previewWidth > window.innerWidth - MOTION.preview.edgeGapPx) {
		x = pointerX - previewWidth - offsetX;
	}
	if (y < MOTION.preview.edgeGapPx) {
		y = pointerY + offsetY;
	}

	targetX = clamp(x, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerWidth - previewWidth - MOTION.preview.edgeGapPx));
	targetY = clamp(y, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerHeight - previewHeight - MOTION.preview.edgeGapPx));
};

const applyPosition = (x: number, y: number): void => {
	if (!previewElements) return;
	previewElements.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
};

const renderPosition = (): void => {
	animationFrame = 0;

	if (!activeTarget) return;

	updateTargetPosition();

	if (!hasPosition || reduceMotionQuery.matches) {
		currentX = targetX;
		currentY = targetY;
		hasPosition = true;
	} else {
		const stiffness = activeMode === 'artifact' ? MOTION.preview.artifactStiffness : MOTION.preview.linkStiffness;
		currentX += (targetX - currentX) * stiffness;
		currentY += (targetY - currentY) * stiffness;
	}

	applyPosition(currentX, currentY);

	const delta = Math.abs(currentX - targetX) + Math.abs(currentY - targetY);
	if (delta > MOTION.preview.settleDeltaPx) {
		animationFrame = requestAnimationFrame(renderPosition);
	}
};

const requestPositionFrame = (): void => {
	if (animationFrame !== 0) return;
	animationFrame = requestAnimationFrame(renderPosition);
};

const storePointer = (event: PointerEvent): void => {
	pointerX = event.clientX;
	pointerY = event.clientY;
	requestPositionFrame();
};

const clearActiveState = (): void => {
	if (activeTarget) {
		delete activeTarget.dataset['hoverPreviewActive'];
	}
	if (activeScope) {
		delete activeScope.dataset['hoverPreviewActive'];
	}
	activeTarget = undefined;
	activeScope = undefined;
	delete document.documentElement.dataset['hoverPreviewMode'];
};

const rememberRecentTarget = (target: HTMLElement | undefined): void => {
	if (!target) return;
	recentTarget = target;
	recentTargetAt = performance.now();
};

const recentDirectionTarget = (): HTMLElement | undefined => {
	if (!recentTarget || performance.now() - recentTargetAt > MOTION.preview.directionMemoryMs) {
		recentTarget = undefined;
		return undefined;
	}
	return recentTarget;
};

const directionBetweenTargets = (previousTarget: HTMLElement | undefined, nextTarget: HTMLElement): PreviewFlow => {
	if (!previousTarget || previousTarget === nextTarget || !previousTarget.isConnected || !nextTarget.isConnected) {
		return activeFlow;
	}

	const position = previousTarget.compareDocumentPosition(nextTarget);
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) return 'down';
	if (position & Node.DOCUMENT_POSITION_PRECEDING) return 'up';
	return activeFlow;
};

const resolvePreviewFlow = (target: HTMLElement, mode: PreviewMode): PreviewFlow => {
	if (mode !== 'artifact') return 'down';
	return directionBetweenTargets(activeTarget ?? recentDirectionTarget(), target);
};

const setActiveSlot = (slot: PreviewSlot, flow: PreviewFlow): void => {
	activeFlow = flow;

	if (activeSlot === slot) {
		slot.lastUsed = performance.now();
		if (slot.root.dataset['state'] !== 'active' && slot.root.dataset['state'] !== 'moving') {
			beginSlotEnter(slot, flow);
		}
		if (isVideoSlot(slot) && slot.media.paused) playVideoSlot(slot);
		return;
	}

	if (activeSlot && activeSlot !== slot) {
		beginSlotExit(activeSlot, flow);
		pauseVideoSlotSoon(activeSlot);
	}

	activeSlot = slot;
	slot.lastUsed = performance.now();
	beginSlotEnter(slot, flow);

	if (isVideoSlot(slot)) {
		playVideoSlot(slot);
	}
};

const showPreview = (target: HTMLElement, event: PointerEvent): void => {
	if (!isEnabled()) return;
	if (!isRevealReady(target)) {
		hidePreview(target);
		return;
	}

	const config = readConfig(target);
	if (!config) return;

	const elements = getPreviewElements();
	clearHideHandle();
	const flow = resolvePreviewFlow(target, config.mode);

	if (activeTarget && activeTarget !== target) {
		delete activeTarget.dataset['hoverPreviewActive'];
	}
	if (activeScope && activeScope !== target.closest(SCOPE_SELECTOR)) {
		delete activeScope.dataset['hoverPreviewActive'];
	}

	activeTarget = target;
	activeScope = target.closest<HTMLElement>(SCOPE_SELECTOR) ?? undefined;
	activeMode = config.mode;
	activeRatio = config.ratio;
	target.dataset['hoverPreviewActive'] = 'true';
	if (activeScope) {
		activeScope.dataset['hoverPreviewActive'] = 'true';
	}
	document.documentElement.dataset['hoverPreviewMode'] = config.mode;

	elements.root.hidden = false;
	elements.root.dataset['state'] = 'visible';
	elements.root.dataset['mode'] = config.mode;
	elements.card.style.setProperty('--hover-preview-ratio', String(config.ratio));

	recalculatePreviewSize();
	setActiveSlot(getSlot(config), flow);
	storePointer(event);

	if (!hasPosition) {
		updateTargetPosition();
		currentX = targetX;
		currentY = targetY;
		hasPosition = true;
		applyPosition(currentX, currentY);
	}
};

const hidePreview = (target?: HTMLElement): void => {
	if (target && target !== activeTarget) return;

	rememberRecentTarget(activeTarget);
	clearActiveState();
	hasPosition = false;
	stopAnimation();

	if (activeSlot) {
		beginSlotExit(activeSlot, activeFlow);
		pauseVideoSlotSoon(activeSlot);
		activeSlot = undefined;
	}

	const elements = previewElements;
	if (!elements) return;

	elements.root.dataset['state'] = 'hiding';

	clearHideHandle();
	hideHandle = window.setTimeout(() => {
		if (activeTarget) return;
		elements.root.dataset['state'] = 'hidden';
		elements.root.hidden = true;
		recentTarget = undefined;
		activeFlow = 'down';
		enforceVideoCacheLimit();
	}, MOTION.preview.hideDelayMs);
};

const disposePreviewElements = (): void => {
	clearActiveState();
	hasPosition = false;
	stopAnimation();
	clearHideHandle();

	for (const slot of slots.values()) {
		clearSlotMotionHandle(slot);
		pauseVideoSlot(slot);
		slot.root.remove();
	}
	slots.clear();
	activeSlot = undefined;
	recentTarget = undefined;
	activeFlow = 'down';
	cardResizeObserver?.disconnect();
	cardResizeObserver = undefined;

	previewElements?.root.remove();
	previewElements = undefined;
};

const targetFromEvent = (event: Event): HTMLElement | undefined => {
	if (!(event.target instanceof Element)) return undefined;
	const target = event.target.closest<HTMLElement>(TARGET_SELECTOR);
	if (!target || !isRevealReady(target)) return undefined;
	return target;
};

const handlePointerOver = (event: PointerEvent): void => {
	const target = targetFromEvent(event);
	if (!target) return;
	if (target === activeTarget) {
		storePointer(event);
		return;
	}

	showPreview(target, event);
};

const handlePointerMove = (event: PointerEvent): void => {
	const target = targetFromEvent(event);
	if (activeTarget && !isRevealReady(activeTarget)) {
		hidePreview(activeTarget);
		return;
	}
	if (target && target !== activeTarget) {
		showPreview(target, event);
		return;
	}
	if (!activeTarget || target !== activeTarget) return;
	storePointer(event);
};

const handlePointerOut = (event: PointerEvent): void => {
	if (!activeTarget) return;
	if (!isRevealReady(activeTarget)) {
		hidePreview(activeTarget);
		return;
	}
	const relatedTarget = event.relatedTarget;

	if (relatedTarget instanceof Node && activeTarget.contains(relatedTarget)) return;
	const nextTarget = relatedTarget instanceof Element ? relatedTarget.closest<HTMLElement>(TARGET_SELECTOR) : undefined;
	if (nextTarget === activeTarget) return;
	if (nextTarget && isRevealReady(nextTarget)) return;

	hidePreview(activeTarget);
};

const handleCapabilityChange = (): void => {
	if (!isEnabled()) {
		hidePreview();
		return;
	}
};

const handleMotionChange = (): void => {
	if (reduceMotionQuery.matches) {
		pauseInactiveVideos();
		if (activeSlot) pauseVideoSlot(activeSlot);
		return;
	}
	if (activeSlot) playVideoSlot(activeSlot);
	requestPositionFrame();
};

const handleDeviceProfileChange = (): void => {
	if (!canPlayPreviewVideo()) {
		pauseAllVideos();
	}
	prewarmImagePreviews();
};

window.addEventListener('resize', () => {
	recalculatePreviewSize();
	requestPositionFrame();
});
document.addEventListener('pointerover', handlePointerOver, { passive: true });
document.addEventListener('pointermove', handlePointerMove, { passive: true });
document.addEventListener('pointerout', handlePointerOut, { passive: true });
document.addEventListener('visibilitychange', () => {
	if (document.hidden) pauseAllVideos();
});
enableQuery.addEventListener('change', handleCapabilityChange);
reduceMotionQuery.addEventListener('change', handleMotionChange);
document.addEventListener('line-reveal-group-complete', prewarmImagePreviews);
document.addEventListener('astro:page-load', () => {
	hasPrewarmedImages = false;
	prewarmImagePreviews();
});
subscribeDeviceProfile(handleDeviceProfileChange);
document.addEventListener('astro:before-swap', disposePreviewElements);
