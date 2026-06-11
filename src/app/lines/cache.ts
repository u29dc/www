import type { LineRevealProfile } from './measure';
import { MOTION } from '../motion/tokens';

type Rect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
	width: number;
	height: number;
};

export type CachedLineRect = {
	top: number;
	height: number;
};

export type LinePlanSignature = {
	key: string;
	contentSignature: string;
	typographySignature: string;
	dprBucket: number;
	fontGeneration: number;
	profile: LineRevealProfile;
};

export type CachedLinePlan = LinePlanSignature & {
	targetWidth: number;
	targetHeight: number;
	lineRects: CachedLineRect[];
	createdAt: number;
	lastUsed: number;
};

const MAX_CACHE_ENTRIES = 192;
const DPR_BUCKET_STEP = 0.25;
const TARGET_SELECTOR = '[data-line-reveal]';
const ATOMIC_SIGNATURE_SELECTOR = 'a, button, canvas, code, input, kbd, select, svg, textarea, video, [data-line-atomic], [data-link-arrow], [data-footnote-ref]';
const cache = new Map<string, CachedLinePlan>();
let fontGeneration = 0;
let hasInitialized = false;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const hash = (value: string): string => {
	let output = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		output ^= value.charCodeAt(index);
		output = Math.imul(output, 16777619);
	}
	return (output >>> 0).toString(36);
};

const round = (value: number, precision = 100): number => Math.round(value * precision) / precision;

const bucketWidth = (width: number): number => Math.round(width / Math.max(MOTION.line.widthChangeTolerancePx, 1)) * Math.max(MOTION.line.widthChangeTolerancePx, 1);

const dprBucket = (): number => (isBrowser() ? Math.round((window.devicePixelRatio || 1) / DPR_BUCKET_STEP) * DPR_BUCKET_STEP : 1);

const targetOrder = (target: HTMLElement): number => {
	if (!isBrowser()) return 0;
	return Array.from(document.querySelectorAll(TARGET_SELECTOR)).indexOf(target);
};

const routePath = (): string => (isBrowser() ? window.location.pathname : 'ssr');

const atomicSignature = (target: HTMLElement): string => {
	const parts: string[] = [];
	for (const element of target.querySelectorAll<HTMLElement>(ATOMIC_SIGNATURE_SELECTOR)) {
		parts.push(
			[
				element.tagName.toLowerCase(),
				element.getAttribute('href') ?? '',
				element.getAttribute('class') ?? '',
				element.getAttribute('data-line-atomic') ?? '',
				element.getAttribute('data-link-arrow') ?? '',
				element.getAttribute('data-footnote-ref') ?? '',
				element.textContent?.trim() ?? '',
			].join(':'),
		);
	}
	return parts.join('|');
};

export const readLineContentSignature = (target: HTMLElement): string => hash([target.textContent ?? '', atomicSignature(target)].join('::'));

export const readLineTypographySignature = (target: HTMLElement): string => {
	const style = getComputedStyle(target);
	return hash(
		[
			style.font,
			style.lineHeight,
			style.letterSpacing,
			style.wordSpacing,
			style.textTransform,
			style.fontFeatureSettings,
			style.fontKerning,
			style.fontVariant,
			style.fontVariationSettings,
			style.direction,
			style.textAlign,
			document.documentElement.dataset['theme'] ?? '',
			document.documentElement.dataset['motionQuality'] ?? '',
		].join('|'),
	);
};

export const createLinePlanSignature = (target: HTMLElement, targetRect: Rect, profile: LineRevealProfile, typographySignature = readLineTypographySignature(target)): LinePlanSignature => {
	const contentSignature = readLineContentSignature(target);
	const widthBucket = bucketWidth(targetRect.width);
	const key = [routePath(), target.dataset['lineRevealKey'] ?? targetOrder(target), widthBucket, contentSignature, typographySignature, profile, dprBucket(), fontGeneration].join('|');

	return {
		key,
		contentSignature,
		typographySignature,
		dprBucket: dprBucket(),
		fontGeneration,
		profile,
	};
};

export const readCachedLinePlan = (signature: LinePlanSignature, targetRect: Rect): CachedLinePlan | undefined => {
	const plan = cache.get(signature.key);
	if (!plan) return undefined;

	if (plan.contentSignature !== signature.contentSignature || plan.typographySignature !== signature.typographySignature || plan.profile !== signature.profile) {
		cache.delete(signature.key);
		return undefined;
	}

	if (Math.abs(plan.targetWidth - targetRect.width) > MOTION.line.widthChangeTolerancePx || Math.abs(plan.targetHeight - targetRect.height) > MOTION.line.widthChangeTolerancePx * 4) {
		cache.delete(signature.key);
		return undefined;
	}

	plan.lastUsed = performance.now();
	return plan;
};

const canWriteLinePlan = (): boolean => {
	if (!isBrowser()) return false;
	const fonts = document.fonts;
	return !fonts || fonts.status === 'loaded';
};

const enforceLimit = (): void => {
	if (cache.size <= MAX_CACHE_ENTRIES) return;

	const entries = Array.from(cache.values()).toSorted((a, b) => a.lastUsed - b.lastUsed);
	while (cache.size > MAX_CACHE_ENTRIES) {
		const entry = entries.shift();
		if (!entry) return;
		cache.delete(entry.key);
	}
};

export const writeCachedLinePlan = (signature: LinePlanSignature, targetRect: Rect, lineRects: Rect[]): void => {
	if (!canWriteLinePlan()) return;

	const now = performance.now();
	cache.set(signature.key, {
		...signature,
		targetWidth: targetRect.width,
		targetHeight: targetRect.height,
		lineRects: lineRects.map((rect) => ({
			top: round(rect.top - targetRect.top),
			height: round(rect.height),
		})),
		createdAt: now,
		lastUsed: now,
	});
	enforceLimit();
};

export const clearLinePlanCache = (): void => {
	cache.clear();
};

export const initLinePlanCache = (): void => {
	if (!isBrowser() || hasInitialized) return;
	hasInitialized = true;

	const clearForTypographyChange = (): void => {
		fontGeneration += 1;
		clearLinePlanCache();
	};

	document.fonts?.addEventListener?.('loadingdone', clearForTypographyChange);

	const observer = new MutationObserver((entries) => {
		if (entries.some((entry) => entry.attributeName === 'data-theme' || entry.attributeName === 'class' || entry.attributeName === 'style')) {
			clearForTypographyChange();
		}
	});

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class', 'data-theme', 'style'],
	});
};
