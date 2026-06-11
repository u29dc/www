import { canUseHoverVideo, getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../device/device';
import { MOTION } from '../motion/tokens';
import { onNextFrame } from '../runtime/loop';
import { createTask } from '../runtime/task';
import { setTimer, type TimerHandle } from '../runtime/timer';
import { onRouteBeforeSwap, onRouteLoad } from '../route/route';

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

const state = {
	enableQuery: window.matchMedia(ENABLE_QUERY),
	reduceMotionQuery: window.matchMedia(REDUCED_MOTION_QUERY),
	slots: new Map<string, PreviewSlot>(),
	elements: undefined as PreviewElements | undefined,
	activeTarget: undefined as HTMLElement | undefined,
	activeScope: undefined as HTMLElement | undefined,
	activeSlot: undefined as PreviewSlot | undefined,
	activeMode: 'link' as PreviewMode,
	activeRatio: MOTION.preview.defaultRatio as number,
	activeFlow: 'down' as PreviewFlow,
	recentTarget: undefined as HTMLElement | undefined,
	recentTargetAt: 0,
	hideHandle: undefined as TimerHandle | undefined,
	pointerX: 0,
	pointerY: 0,
	currentX: 0,
	currentY: 0,
	targetX: 0,
	targetY: 0,
	width: MOTION.preview.defaultWidthPx as number,
	height: MOTION.preview.defaultHeightPx as number,
	hasPosition: false,
	cardResizeObserver: undefined as ResizeObserver | undefined,
	hasPrewarmedImages: false,
	initialized: false,
	positionActive: false,
	shouldWritePosition: false,
	shouldSleepAfterWrite: false,
	wake: (() => {}) as (reason?: string) => void,
	sleep: (() => {}) as () => void,
	cleanups: [] as Array<() => void>,
};

export const preview = createTask({
	name: 'preview',
	order: 70,
	state,
	preinit(context) {
		state.wake = context.wake;
		state.sleep = context.sleep;
		bindPreview();
	},
	init() {
		state.hasPrewarmedImages = false;
		prewarmImagePreviews();
	},
	update() {
		if (!state.positionActive) {
			state.sleep();
			return;
		}
		updatePosition();
	},
	write() {
		if (!state.shouldWritePosition) return;
		state.shouldWritePosition = false;
		applyPosition(state.currentX, state.currentY);
	},
	post() {
		if (!state.shouldSleepAfterWrite) return;
		state.shouldSleepAfterWrite = false;
		state.sleep();
	},
	dispose() {
		for (const cleanup of state.cleanups.splice(0)) cleanup();
		disposePreviewElements();
		state.initialized = false;
	},
});

const isEnabled = (): boolean => state.enableQuery.matches;

const canPlayPreviewVideo = (): boolean => canUseHoverVideo(getDeviceProfile()) && !state.reduceMotionQuery.matches && !document.hidden;

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
	if (state.hideHandle === undefined) return;
	state.hideHandle.cancel();
	state.hideHandle = undefined;
};

const clearPauseHandle = (slot: PreviewSlot): void => {
	if (slot.pauseHandle === undefined) return;
	slot.pauseHandle.cancel();
	delete slot.pauseHandle;
};

const clearSlotMotionHandle = (slot: PreviewSlot): void => {
	if (slot.motionHandle === undefined) return;
	slot.motionHandle.cancel();
	delete slot.motionHandle;
};

const completeSlotMotionSoon = (slot: PreviewSlot, expectedState: string, completeState: string): void => {
	clearSlotMotionHandle(slot);
	slot.motionHandle = setTimer('preview.slot.complete', MOTION.preview.slotReelMs + MOTION.preview.slotReelBufferMs, () => {
		if (slot.root.dataset['state'] === expectedState) {
			if (completeState === 'idle') {
				resetSlotToIdle(slot, true);
			} else {
				slot.root.dataset['state'] = completeState;
			}
		}
		delete slot.motionHandle;
	});
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
	onNextFrame('preview.slot.instant', () => {
		if (slot.root.dataset['motion'] === 'instant') {
			delete slot.root.dataset['motion'];
		}
	});
};

const beginSlotEnter = (slot: PreviewSlot, flow: PreviewFlow): void => {
	clearSlotMotionHandle(slot);
	slot.root.dataset['flow'] = flow;

	if (state.reduceMotionQuery.matches) {
		slot.root.dataset['state'] = 'active';
		setSlotOffset(slot, '0%');
		return;
	}

	const slotState = slot.root.dataset['state'];
	if (slotState === 'idle') {
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

	if (state.reduceMotionQuery.matches) {
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
		state.cardResizeObserver?.disconnect();
		state.cardResizeObserver = new ResizeObserver(([entry]) => {
			const rect = entry?.contentRect;
			if (!rect || rect.width <= 0 || rect.height <= 0) return;
			state.width = rect.width;
			state.height = rect.height;
			requestPositionFrame();
		});
		state.cardResizeObserver.observe(card);
	}

	return { root, card, deck };
};

const getPreviewElements = (): PreviewElements => {
	if (!state.elements || !state.elements.root.isConnected) {
		state.elements?.root.remove();
		state.elements = createPreviewElements();
	}
	return state.elements;
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
	state.slots.set(slot.key, slot);
	return slot;
};

const getSlot = (config: PreviewConfig): PreviewSlot => {
	const key = slotKey(config);
	const slot = state.slots.get(key) ?? createSlot(config);
	updateSlotConfig(slot, config);
	return slot;
};

const stopAnimation = (): void => {
	state.positionActive = false;
	state.shouldWritePosition = false;
	state.sleep();
};

const pauseVideoSlot = (slot: PreviewSlot): void => {
	if (!isVideoSlot(slot)) return;
	clearPauseHandle(slot);
	slot.media.pause();
};

const pauseVideoSlotSoon = (slot: PreviewSlot): void => {
	if (!isVideoSlot(slot)) return;
	clearPauseHandle(slot);
	slot.pauseHandle = setTimer('preview.video.pause', MOTION.preview.pauseDelayMs, () => {
		if (slot !== state.activeSlot) slot.media.pause();
		delete slot.pauseHandle;
	});
};

const pauseInactiveVideos = (): void => {
	for (const slot of state.slots.values()) {
		if (slot !== state.activeSlot) pauseVideoSlot(slot);
	}
};

const pauseAllVideos = (): void => {
	for (const slot of state.slots.values()) {
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
	state.slots.delete(slot.key);
};

const videoSlotCount = (): number => Array.from(state.slots.values()).filter(isVideoSlot).length;

const enforceVideoCacheLimit = (): void => {
	const inactiveVideos = Array.from(state.slots.values())
		.filter((slot) => isVideoSlot(slot) && slot !== state.activeSlot)
		.toSorted((a, b) => a.lastUsed - b.lastUsed);

	while (videoSlotCount() > MOTION.preview.videoSlotLimit && inactiveVideos.length > 0) {
		const slot = inactiveVideos.shift();
		if (slot) removeSlot(slot);
	}
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const recalculatePreviewSize = (): void => {
	const elements = state.elements;
	if (!elements || elements.root.hidden) return;

	const rect = elements.card.getBoundingClientRect();
	state.width = rect.width || state.width;
	state.height = rect.height || state.width / state.activeRatio;
};

const idle = (callback: () => void): void => {
	const win = window as Window & {
		requestIdleCallback?: (idleCallback: IdleRequestCallback, options?: IdleRequestOptions) => number;
	};
	if (typeof win.requestIdleCallback === 'function') {
		win.requestIdleCallback(callback, { timeout: 900 });
		return;
	}
	setTimer('preview.idle', 300, callback);
};

const prewarmImagePreviews = (): void => {
	if (state.hasPrewarmedImages || document.hidden || state.reduceMotionQuery.matches) return;
	const profile = getDeviceProfile();
	if (profile.tier === 'low' || profile.networkProfile === 'save-data') return;

	const targets = Array.from(document.querySelectorAll<HTMLElement>(`${TARGET_SELECTOR}[data-hover-preview-kind="image"]`))
		.filter(isRevealReady)
		.slice(0, 3);
	if (targets.length === 0) return;

	state.hasPrewarmedImages = true;
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
	const offsetX = state.activeMode === 'artifact' ? MOTION.preview.artifactOffsetX : MOTION.preview.linkOffsetX;
	const offsetY = state.activeMode === 'artifact' ? MOTION.preview.artifactOffsetY : MOTION.preview.linkOffsetY;

	let x = state.pointerX + offsetX;
	let y = state.pointerY - state.height - offsetY;

	if (x + state.width > window.innerWidth - MOTION.preview.edgeGapPx) {
		x = state.pointerX - state.width - offsetX;
	}
	if (y < MOTION.preview.edgeGapPx) {
		y = state.pointerY + offsetY;
	}

	state.targetX = clamp(x, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerWidth - state.width - MOTION.preview.edgeGapPx));
	state.targetY = clamp(y, MOTION.preview.edgeGapPx, Math.max(MOTION.preview.edgeGapPx, window.innerHeight - state.height - MOTION.preview.edgeGapPx));
};

const applyPosition = (x: number, y: number): void => {
	if (!state.elements) return;
	state.elements.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
};

const updatePosition = (): void => {
	if (!state.activeTarget) {
		state.positionActive = false;
		state.shouldWritePosition = false;
		state.shouldSleepAfterWrite = true;
		return;
	}

	updateTargetPosition();

	if (!state.hasPosition || state.reduceMotionQuery.matches) {
		state.currentX = state.targetX;
		state.currentY = state.targetY;
		state.hasPosition = true;
	} else {
		const stiffness = state.activeMode === 'artifact' ? MOTION.preview.artifactStiffness : MOTION.preview.linkStiffness;
		state.currentX += (state.targetX - state.currentX) * stiffness;
		state.currentY += (state.targetY - state.currentY) * stiffness;
	}

	state.shouldWritePosition = true;

	const delta = Math.abs(state.currentX - state.targetX) + Math.abs(state.currentY - state.targetY);
	state.positionActive = delta > MOTION.preview.settleDeltaPx;
	if (!state.positionActive) {
		state.shouldSleepAfterWrite = true;
	}
};

const requestPositionFrame = (): void => {
	state.positionActive = true;
	state.shouldSleepAfterWrite = false;
	state.wake('preview:position');
};

const storePointer = (event: PointerEvent): void => {
	state.pointerX = event.clientX;
	state.pointerY = event.clientY;
	requestPositionFrame();
};

const clearActiveState = (): void => {
	if (state.activeTarget) {
		delete state.activeTarget.dataset['hoverPreviewActive'];
	}
	if (state.activeScope) {
		delete state.activeScope.dataset['hoverPreviewActive'];
	}
	state.activeTarget = undefined;
	state.activeScope = undefined;
	delete document.documentElement.dataset['hoverPreviewMode'];
};

const rememberRecentTarget = (target: HTMLElement | undefined): void => {
	if (!target) return;
	state.recentTarget = target;
	state.recentTargetAt = performance.now();
};

const recentDirectionTarget = (): HTMLElement | undefined => {
	if (!state.recentTarget || performance.now() - state.recentTargetAt > MOTION.preview.directionMemoryMs) {
		state.recentTarget = undefined;
		return undefined;
	}
	return state.recentTarget;
};

const directionBetweenTargets = (previousTarget: HTMLElement | undefined, nextTarget: HTMLElement): PreviewFlow => {
	if (!previousTarget || previousTarget === nextTarget || !previousTarget.isConnected || !nextTarget.isConnected) {
		return state.activeFlow;
	}

	const position = previousTarget.compareDocumentPosition(nextTarget);
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) return 'down';
	if (position & Node.DOCUMENT_POSITION_PRECEDING) return 'up';
	return state.activeFlow;
};

const resolvePreviewFlow = (target: HTMLElement, mode: PreviewMode): PreviewFlow => {
	if (mode !== 'artifact') return 'down';
	return directionBetweenTargets(state.activeTarget ?? recentDirectionTarget(), target);
};

const setActiveSlot = (slot: PreviewSlot, flow: PreviewFlow): void => {
	state.activeFlow = flow;

	if (state.activeSlot === slot) {
		slot.lastUsed = performance.now();
		if (slot.root.dataset['state'] !== 'active' && slot.root.dataset['state'] !== 'moving') {
			beginSlotEnter(slot, flow);
		}
		if (isVideoSlot(slot) && slot.media.paused) playVideoSlot(slot);
		return;
	}

	if (state.activeSlot && state.activeSlot !== slot) {
		beginSlotExit(state.activeSlot, flow);
		pauseVideoSlotSoon(state.activeSlot);
	}

	state.activeSlot = slot;
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

	if (state.activeTarget && state.activeTarget !== target) {
		delete state.activeTarget.dataset['hoverPreviewActive'];
	}
	if (state.activeScope && state.activeScope !== target.closest(SCOPE_SELECTOR)) {
		delete state.activeScope.dataset['hoverPreviewActive'];
	}

	state.activeTarget = target;
	state.activeScope = target.closest<HTMLElement>(SCOPE_SELECTOR) ?? undefined;
	state.activeMode = config.mode;
	state.activeRatio = config.ratio;
	target.dataset['hoverPreviewActive'] = 'true';
	if (state.activeScope) {
		state.activeScope.dataset['hoverPreviewActive'] = 'true';
	}
	document.documentElement.dataset['hoverPreviewMode'] = config.mode;

	elements.root.hidden = false;
	elements.root.dataset['state'] = 'visible';
	elements.root.dataset['mode'] = config.mode;
	elements.card.style.setProperty('--hover-preview-ratio', String(config.ratio));

	recalculatePreviewSize();
	setActiveSlot(getSlot(config), flow);
	storePointer(event);

	if (!state.hasPosition) {
		updateTargetPosition();
		state.currentX = state.targetX;
		state.currentY = state.targetY;
		state.hasPosition = true;
		applyPosition(state.currentX, state.currentY);
	}
};

const hidePreview = (target?: HTMLElement): void => {
	if (target && target !== state.activeTarget) return;

	rememberRecentTarget(state.activeTarget);
	clearActiveState();
	state.hasPosition = false;
	stopAnimation();

	if (state.activeSlot) {
		beginSlotExit(state.activeSlot, state.activeFlow);
		pauseVideoSlotSoon(state.activeSlot);
		state.activeSlot = undefined;
	}

	const elements = state.elements;
	if (!elements) return;

	elements.root.dataset['state'] = 'hiding';

	clearHideHandle();
	state.hideHandle = setTimer('preview.hide', MOTION.preview.hideDelayMs, () => {
		if (state.activeTarget) return;
		elements.root.dataset['state'] = 'hidden';
		elements.root.hidden = true;
		state.recentTarget = undefined;
		state.activeFlow = 'down';
		enforceVideoCacheLimit();
	});
};

const disposePreviewElements = (): void => {
	clearActiveState();
	state.hasPosition = false;
	stopAnimation();
	clearHideHandle();

	for (const slot of state.slots.values()) {
		clearSlotMotionHandle(slot);
		pauseVideoSlot(slot);
		slot.root.remove();
	}
	state.slots.clear();
	state.activeSlot = undefined;
	state.recentTarget = undefined;
	state.activeFlow = 'down';
	state.cardResizeObserver?.disconnect();
	state.cardResizeObserver = undefined;

	state.elements?.root.remove();
	state.elements = undefined;
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
	if (target === state.activeTarget) {
		storePointer(event);
		return;
	}

	showPreview(target, event);
};

const handlePointerMove = (event: PointerEvent): void => {
	const target = targetFromEvent(event);
	if (state.activeTarget && !isRevealReady(state.activeTarget)) {
		hidePreview(state.activeTarget);
		return;
	}
	if (target && target !== state.activeTarget) {
		showPreview(target, event);
		return;
	}
	if (!state.activeTarget || target !== state.activeTarget) return;
	storePointer(event);
};

const handlePointerOut = (event: PointerEvent): void => {
	if (!state.activeTarget) return;
	if (!isRevealReady(state.activeTarget)) {
		hidePreview(state.activeTarget);
		return;
	}
	const relatedTarget = event.relatedTarget;

	if (relatedTarget instanceof Node && state.activeTarget.contains(relatedTarget)) return;
	const nextTarget = relatedTarget instanceof Element ? relatedTarget.closest<HTMLElement>(TARGET_SELECTOR) : undefined;
	if (nextTarget === state.activeTarget) return;
	if (nextTarget && isRevealReady(nextTarget)) return;

	hidePreview(state.activeTarget);
};

const handleCapabilityChange = (): void => {
	if (!isEnabled()) {
		hidePreview();
		return;
	}
};

const handleMotionChange = (): void => {
	if (state.reduceMotionQuery.matches) {
		pauseInactiveVideos();
		if (state.activeSlot) pauseVideoSlot(state.activeSlot);
		return;
	}
	if (state.activeSlot) playVideoSlot(state.activeSlot);
	requestPositionFrame();
};

const handleDeviceProfileChange = (): void => {
	if (!canPlayPreviewVideo()) {
		pauseAllVideos();
	}
	prewarmImagePreviews();
};

const bindPreview = (): void => {
	if (state.initialized) return;
	state.initialized = true;

	initDeviceProfile();
	const handleResize = (): void => {
		recalculatePreviewSize();
		requestPositionFrame();
	};
	const handleVisibilityChange = (): void => {
		if (document.hidden) pauseAllVideos();
	};
	window.addEventListener('resize', handleResize, { passive: true });
	state.cleanups.push(() => window.removeEventListener('resize', handleResize));
	document.addEventListener('pointerover', handlePointerOver, { passive: true });
	state.cleanups.push(() => document.removeEventListener('pointerover', handlePointerOver));
	document.addEventListener('pointermove', handlePointerMove, { passive: true });
	state.cleanups.push(() => document.removeEventListener('pointermove', handlePointerMove));
	document.addEventListener('pointerout', handlePointerOut, { passive: true });
	state.cleanups.push(() => document.removeEventListener('pointerout', handlePointerOut));
	document.addEventListener('visibilitychange', handleVisibilityChange);
	state.cleanups.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));
	state.enableQuery.addEventListener('change', handleCapabilityChange);
	state.cleanups.push(() => state.enableQuery.removeEventListener('change', handleCapabilityChange));
	state.reduceMotionQuery.addEventListener('change', handleMotionChange);
	state.cleanups.push(() => state.reduceMotionQuery.removeEventListener('change', handleMotionChange));
	document.addEventListener('line-reveal-group-complete', prewarmImagePreviews);
	state.cleanups.push(() => document.removeEventListener('line-reveal-group-complete', prewarmImagePreviews));
	state.cleanups.push(
		onRouteLoad(() => {
			state.hasPrewarmedImages = false;
			prewarmImagePreviews();
		}),
	);
	state.cleanups.push(onRouteBeforeSwap(disposePreviewElements));
	state.cleanups.push(subscribeDeviceProfile(handleDeviceProfileChange));
};
