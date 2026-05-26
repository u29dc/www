type PreviewKind = 'image' | 'video';
type PreviewMode = 'artifact' | 'link';
type PreviewFit = 'cover' | 'contain';

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
const HIDE_DELAY_MS = 180;
const PAUSE_DELAY_MS = 180;
const EDGE_GAP = 12;
const VIDEO_SLOT_LIMIT = 4;

const enableQuery = window.matchMedia(ENABLE_QUERY);
const reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
const slots = new Map<string, PreviewSlot>();

let previewElements: PreviewElements | undefined;
let activeTarget: HTMLElement | undefined;
let activeScope: HTMLElement | undefined;
let activeSlot: PreviewSlot | undefined;
let activeMode: PreviewMode = 'link';
let activeRatio = 1.6;
let hideHandle: number | undefined;
let animationFrame = 0;
let pointerX = 0;
let pointerY = 0;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
let previewWidth = 280;
let previewHeight = 180;
let hasPosition = false;

const isEnabled = (): boolean => enableQuery.matches;

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
	return Number.isFinite(ratio) && ratio > 0 ? ratio : 1.6;
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
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.preload = 'metadata';
	video.crossOrigin = 'anonymous';
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
	}, PAUSE_DELAY_MS);
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
	if (!isVideoSlot(slot) || reduceMotionQuery.matches || document.hidden) return;

	clearPauseHandle(slot);
	if (!slot.ready) {
		const frameRequester = slot.media as VideoFrameRequester;
		frameRequester.requestVideoFrameCallback?.(() => markSlotReady(slot));
	}
	void slot.media.play().catch(() => {});
};

const removeSlot = (slot: PreviewSlot): void => {
	pauseVideoSlot(slot);
	slot.root.remove();
	slots.delete(slot.key);
};

const videoSlotCount = (): number => Array.from(slots.values()).filter(isVideoSlot).length;

const enforceVideoCacheLimit = (): void => {
	const inactiveVideos = Array.from(slots.values())
		.filter((slot) => isVideoSlot(slot) && slot !== activeSlot)
		.toSorted((a, b) => a.lastUsed - b.lastUsed);

	while (videoSlotCount() > VIDEO_SLOT_LIMIT && inactiveVideos.length > 0) {
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

const updateTargetPosition = (): void => {
	const offsetX = activeMode === 'artifact' ? 22 : 14;
	const offsetY = activeMode === 'artifact' ? 18 : 12;

	let x = pointerX + offsetX;
	let y = pointerY - previewHeight - offsetY;

	if (x + previewWidth > window.innerWidth - EDGE_GAP) {
		x = pointerX - previewWidth - offsetX;
	}
	if (y < EDGE_GAP) {
		y = pointerY + offsetY;
	}

	targetX = clamp(x, EDGE_GAP, Math.max(EDGE_GAP, window.innerWidth - previewWidth - EDGE_GAP));
	targetY = clamp(y, EDGE_GAP, Math.max(EDGE_GAP, window.innerHeight - previewHeight - EDGE_GAP));
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
		const stiffness = activeMode === 'artifact' ? 0.18 : 0.24;
		currentX += (targetX - currentX) * stiffness;
		currentY += (targetY - currentY) * stiffness;
	}

	applyPosition(currentX, currentY);

	const delta = Math.abs(currentX - targetX) + Math.abs(currentY - targetY);
	if (delta > 0.25) {
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

const setActiveSlot = (slot: PreviewSlot): void => {
	if (activeSlot === slot) {
		slot.lastUsed = performance.now();
		if (isVideoSlot(slot) && slot.media.paused) playVideoSlot(slot);
		return;
	}

	if (activeSlot && activeSlot !== slot) {
		activeSlot.root.dataset['state'] = 'idle';
		pauseVideoSlotSoon(activeSlot);
	}

	activeSlot = slot;
	slot.lastUsed = performance.now();
	slot.root.dataset['state'] = 'active';

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
	setActiveSlot(getSlot(config));
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

	clearActiveState();
	hasPosition = false;
	stopAnimation();

	if (activeSlot) {
		activeSlot.root.dataset['state'] = 'idle';
		pauseVideoSlotSoon(activeSlot);
		activeSlot = undefined;
	}

	const elements = previewElements;
	if (!elements) return;

	elements.root.dataset['state'] = 'hidden';

	clearHideHandle();
	hideHandle = window.setTimeout(() => {
		if (activeTarget) return;
		elements.root.hidden = true;
		enforceVideoCacheLimit();
	}, HIDE_DELAY_MS);
};

const disposePreviewElements = (): void => {
	clearActiveState();
	hasPosition = false;
	stopAnimation();
	clearHideHandle();

	for (const slot of slots.values()) {
		pauseVideoSlot(slot);
		slot.root.remove();
	}
	slots.clear();
	activeSlot = undefined;

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
document.addEventListener('astro:before-swap', disposePreviewElements);
