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
};

type PreviewElements = {
	root: HTMLDivElement;
	card: HTMLDivElement;
	image: HTMLImageElement;
	video: HTMLVideoElement;
};

const TARGET_SELECTOR = '[data-hover-preview-target]';
const ENABLE_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const HIDE_DELAY_MS = 180;
const EDGE_GAP = 12;

const enableQuery = window.matchMedia(ENABLE_QUERY);
const reduceMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
const initializedTargets = new WeakSet<HTMLElement>();

let previewElements: PreviewElements | undefined;
let activeTarget: HTMLElement | undefined;
let activeMode: PreviewMode = 'link';
let hideHandle: number | undefined;
let animationFrame = 0;
let pointerX = 0;
let pointerY = 0;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
let hasPosition = false;

const isEnabled = (): boolean => enableQuery.matches;

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
	};
};

const clearHideHandle = (): void => {
	if (hideHandle === undefined) return;
	window.clearTimeout(hideHandle);
	hideHandle = undefined;
};

const createPreviewElements = (): PreviewElements => {
	const root = document.createElement('div');
	root.dataset['hoverPreviewLayer'] = '';
	root.dataset['state'] = 'hidden';
	root.hidden = true;
	root.setAttribute('aria-hidden', 'true');

	const card = document.createElement('div');
	card.dataset['hoverPreviewCard'] = '';

	const image = document.createElement('img');
	image.dataset['hoverPreviewImage'] = '';
	image.decoding = 'async';
	image.draggable = false;
	image.hidden = true;

	const video = document.createElement('video');
	video.dataset['hoverPreviewVideo'] = '';
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.preload = 'metadata';
	video.crossOrigin = 'anonymous';
	video.hidden = true;

	card.append(image, video);
	root.append(card);
	document.body.append(root);

	return { root, card, image, video };
};

const getPreviewElements = (): PreviewElements => {
	previewElements ??= createPreviewElements();
	return previewElements;
};

const stopAnimation = (): void => {
	if (animationFrame === 0) return;
	cancelAnimationFrame(animationFrame);
	animationFrame = 0;
};

const stopVideo = (video: HTMLVideoElement): void => {
	video.pause();
	video.removeAttribute('src');
	video.load();
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const updateTargetPosition = (): void => {
	const elements = getPreviewElements();
	const rect = elements.card.getBoundingClientRect();
	const width = rect.width || 280;
	const height = rect.height || 180;
	const offsetX = activeMode === 'artifact' ? 22 : 14;
	const offsetY = activeMode === 'artifact' ? 18 : 12;

	let x = pointerX + offsetX;
	let y = pointerY - height - offsetY;

	if (x + width > window.innerWidth - EDGE_GAP) {
		x = pointerX - width - offsetX;
	}
	if (y < EDGE_GAP) {
		y = pointerY + offsetY;
	}

	targetX = clamp(x, EDGE_GAP, Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP));
	targetY = clamp(y, EDGE_GAP, Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP));
};

const applyPosition = (x: number, y: number): void => {
	const { root } = getPreviewElements();
	root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
};

const renderPosition = (): void => {
	animationFrame = 0;

	if (!activeTarget) return;

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

const updatePointer = (event: PointerEvent): void => {
	pointerX = event.clientX;
	pointerY = event.clientY;
	updateTargetPosition();
	if (!hasPosition || reduceMotionQuery.matches || document.hidden) {
		currentX = targetX;
		currentY = targetY;
		hasPosition = true;
		applyPosition(currentX, currentY);
		if (reduceMotionQuery.matches || document.hidden) return;
	}
	requestPositionFrame();
};

const setMedia = (elements: PreviewElements, config: PreviewConfig): void => {
	elements.root.dataset['mode'] = config.mode;
	elements.card.style.setProperty('--hover-preview-ratio', String(config.ratio));
	elements.image.style.objectFit = config.fit;
	elements.video.style.objectFit = config.fit;

	if (config.kind === 'image') {
		stopVideo(elements.video);
		elements.video.hidden = true;
		elements.image.hidden = false;
		elements.image.alt = config.alt;
		if (elements.image.src !== config.src) {
			elements.image.src = config.src;
		}
		return;
	}

	elements.image.hidden = true;
	elements.image.removeAttribute('src');
	elements.image.alt = '';
	elements.video.hidden = false;
	if (elements.video.src !== config.src) {
		elements.video.src = config.src;
	}
	void elements.video.play().catch(() => {});
};

const showPreview = (target: HTMLElement, event: PointerEvent): void => {
	if (!isEnabled()) return;

	const config = readConfig(target);
	if (!config) return;

	const elements = getPreviewElements();
	clearHideHandle();

	if (activeTarget && activeTarget !== target) {
		delete activeTarget.dataset['hoverPreviewActive'];
	}

	activeTarget = target;
	activeMode = config.mode;
	target.dataset['hoverPreviewActive'] = 'true';
	document.documentElement.dataset['hoverPreviewMode'] = config.mode;

	setMedia(elements, config);

	elements.root.hidden = false;
	elements.root.dataset['state'] = 'visible';
	hasPosition = false;
	updatePointer(event);
};

const hidePreview = (target?: HTMLElement): void => {
	if (target && target !== activeTarget) return;

	if (activeTarget) {
		delete activeTarget.dataset['hoverPreviewActive'];
	}
	activeTarget = undefined;
	delete document.documentElement.dataset['hoverPreviewMode'];
	hasPosition = false;
	stopAnimation();

	const elements = previewElements;
	if (!elements) return;

	elements.root.dataset['state'] = 'hidden';
	stopVideo(elements.video);

	clearHideHandle();
	hideHandle = window.setTimeout(() => {
		if (activeTarget) return;
		elements.root.hidden = true;
		elements.image.hidden = true;
		elements.image.removeAttribute('src');
	}, HIDE_DELAY_MS);
};

const handlePointerEnter = (event: PointerEvent): void => {
	if (!(event.currentTarget instanceof HTMLElement)) return;
	showPreview(event.currentTarget, event);
};

const handlePointerMove = (event: PointerEvent): void => {
	if (!activeTarget || event.currentTarget !== activeTarget) return;
	updatePointer(event);
};

const handlePointerLeave = (event: PointerEvent): void => {
	if (!(event.currentTarget instanceof HTMLElement)) return;
	hidePreview(event.currentTarget);
};

const setupHoverPreviewTargets = (root: ParentNode = document): void => {
	if (!isEnabled()) return;

	root.querySelectorAll<HTMLElement>(TARGET_SELECTOR).forEach((target) => {
		if (initializedTargets.has(target)) return;
		initializedTargets.add(target);
		target.addEventListener('pointerenter', handlePointerEnter);
		target.addEventListener('pointermove', handlePointerMove);
		target.addEventListener('pointerleave', handlePointerLeave);
	});
};

const handleCapabilityChange = (): void => {
	if (!isEnabled()) {
		hidePreview();
		return;
	}
	setupHoverPreviewTargets();
};

setupHoverPreviewTargets();

enableQuery.addEventListener('change', handleCapabilityChange);
reduceMotionQuery.addEventListener('change', () => {
	if (activeTarget) requestPositionFrame();
});
document.addEventListener('astro:page-load', () => setupHoverPreviewTargets());
document.addEventListener('astro:before-swap', () => hidePreview());
