type LineRevealKind = 'body' | 'origin' | 'title' | 'description' | 'quote';

export type LineRevealProfile = 'full' | 'lite';

export type LineRevealOptions = {
	profile: LineRevealProfile;
	durationMs: number;
	staggerMs: number;
	maxTotalMs: number;
	handoffMs: number;
	staggeredLines: number;
	maxTokens: number;
	maxLinesPerTarget: number;
	measureBudgetMs: number;
	delayOffsetMs?: number;
};

export type PreparedLineReveal = {
	target: HTMLElement;
	overlay: HTMLElement;
	lineCount: number;
	animationMs: number;
	totalMs: number;
	width: number;
	play: () => void;
	cancel: () => void;
	complete: () => void;
};

export type MeasuredLineReveal = {
	target: HTMLElement;
	parent: HTMLElement;
	targetRect: Rect;
	parentRect: Rect;
	parentClientLeft: number;
	parentClientTop: number;
	parentScrollLeft: number;
	parentScrollTop: number;
	parentInlinePosition: string;
	parentComputedPosition: string;
	typography: OverlayTypography;
	lines: Line[];
	lineCount: number;
	options: LineRevealOptions;
	actualStagger: number;
	delayOffsetMs: number;
	lineDelaysMs: number[];
	animationMs: number;
	handoffMs: number;
	totalMs: number;
};

type Rect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
	width: number;
	height: number;
};

type TextToken = {
	kind: 'text';
	text: string;
	rect: Rect;
};

type ElementToken = {
	kind: 'element';
	element: HTMLElement;
	rect: Rect;
};

type Token = TextToken | ElementToken;

type Line = {
	tokens: Token[];
	rect: Rect;
};

type ParentRecord = {
	position: string;
	count: number;
};

type OverlayTypography = {
	color: string;
	direction: string;
	font: string;
	fontFeatureSettings: string;
	fontKerning: string;
	fontVariant: string;
	fontVariationSettings: string;
	letterSpacing: string;
	lineHeight: string;
	textAlign: string;
	textTransform: string;
	wordSpacing: string;
};

const ATOMIC_SELECTOR = ['a', 'button', 'canvas', 'code', 'input', 'kbd', 'select', 'svg', 'textarea', 'video', '[data-line-atomic]', '[data-link-arrow]', '[data-footnote-ref]'].join(',');
const UNSUPPORTED_SELECTOR = 'br, iframe, table, script, style';
const TOKEN_PATTERN = /\S+/gu;
const LINE_TOP_TOLERANCE = 3;
const MIN_RECT_SIZE = 0.2;
const OVERLAY_EDGE_PAD = 1;
const parentRecords = new WeakMap<HTMLElement, ParentRecord>();

const isHTMLElement = (node: Node): node is HTMLElement => node instanceof HTMLElement;

const toRect = (rect: DOMRectReadOnly): Rect => ({
	top: rect.top,
	right: rect.right,
	bottom: rect.bottom,
	left: rect.left,
	width: rect.width,
	height: rect.height,
});

const isVisibleRect = (rect: Rect): boolean => rect.width > MIN_RECT_SIZE && rect.height > MIN_RECT_SIZE;

const unionRects = (rects: Rect[]): Rect | undefined => {
	const first = rects[0];
	if (!first) return undefined;

	let top = first.top;
	let right = first.right;
	let bottom = first.bottom;
	let left = first.left;

	for (const rect of rects.slice(1)) {
		top = Math.min(top, rect.top);
		right = Math.max(right, rect.right);
		bottom = Math.max(bottom, rect.bottom);
		left = Math.min(left, rect.left);
	}

	return {
		top,
		right,
		bottom,
		left,
		width: right - left,
		height: bottom - top,
	};
};

const readRangeRects = (node: Text, start: number, end: number): Rect[] => {
	const range = document.createRange();
	range.setStart(node, start);
	range.setEnd(node, end);

	const rects = Array.from(range.getClientRects()).map(toRect).filter(isVisibleRect);
	return rects;
};

const shouldTreatElementAsAtomic = (element: HTMLElement): boolean => {
	return element.matches(ATOMIC_SELECTOR);
};

const sanitizeClone = (element: HTMLElement): HTMLElement => {
	const clone = element.cloneNode(true) as HTMLElement;
	clone.removeAttribute('id');
	clone.removeAttribute('data-line-reveal');
	clone.removeAttribute('data-line-reveal-state');
	clone.removeAttribute('data-reveal');
	clone.removeAttribute('data-reveal-once');
	clone.dataset['lineClone'] = 'true';

	for (const child of clone.querySelectorAll('[id]')) {
		child.removeAttribute('id');
	}

	for (const child of clone.querySelectorAll('[data-line-reveal], [data-line-reveal-state], [data-reveal], [data-reveal-once]')) {
		child.removeAttribute('data-line-reveal');
		child.removeAttribute('data-line-reveal-state');
		child.removeAttribute('data-reveal');
		child.removeAttribute('data-reveal-once');
	}

	return clone;
};

const collectTextTokens = (node: Text, tokens: Token[]): void => {
	const value = node.data;
	TOKEN_PATTERN.lastIndex = 0;

	let match = TOKEN_PATTERN.exec(value);
	while (match) {
		const text = match[0];
		const start = match.index;
		const end = start + text.length;
		const rects = readRangeRects(node, start, end);

		for (const rect of rects) {
			tokens.push({ kind: 'text', text, rect });
		}

		match = TOKEN_PATTERN.exec(value);
	}
};

const collectElementToken = (element: HTMLElement, tokens: Token[]): void => {
	const rects = Array.from(element.getClientRects()).map(toRect).filter(isVisibleRect);

	for (const rect of rects) {
		tokens.push({ kind: 'element', element, rect });
	}
};

const collectTokens = (root: Node, tokens: Token[]): void => {
	for (const node of root.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			collectTextTokens(node as Text, tokens);
			continue;
		}

		if (!isHTMLElement(node)) continue;

		if (node.matches(UNSUPPORTED_SELECTOR)) {
			throw new Error('line-reveal-unsupported-node');
		}

		if (shouldTreatElementAsAtomic(node)) {
			collectElementToken(node, tokens);
			continue;
		}

		collectTokens(node, tokens);
	}
};

const groupTokensIntoLines = (tokens: Token[]): Line[] => {
	const lines: Line[] = [];

	for (const token of tokens) {
		let activeLine = lines.find((line) => Math.abs(line.rect.top - token.rect.top) <= LINE_TOP_TOLERANCE);

		if (!activeLine) {
			activeLine = { tokens: [], rect: token.rect };
			lines.push(activeLine);
		}

		activeLine.tokens.push(token);
		const nextRect = unionRects([activeLine.rect, token.rect]);
		if (nextRect) activeLine.rect = nextRect;
	}

	return lines.toSorted((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
};

const px = (value: number): string => `${value.toFixed(3)}px`;

const readLineKind = (target: HTMLElement): LineRevealKind | undefined => {
	const value = target.dataset['lineReveal'];
	if (value === 'body' || value === 'origin' || value === 'title' || value === 'description' || value === 'quote') return value;
	return undefined;
};

export const shouldPrepareLineReveal = (target: HTMLElement, options: LineRevealOptions): boolean => {
	const kind = readLineKind(target);
	if (!kind) return false;
	if (options.profile === 'lite') return kind === 'title' || kind === 'quote';
	return true;
};

const retainParent = (parent: HTMLElement, inlinePosition: string, computedPosition: string): void => {
	const existing = parentRecords.get(parent);
	if (existing) {
		existing.count += 1;
		return;
	}

	parentRecords.set(parent, { position: inlinePosition, count: 1 });

	if (computedPosition === 'static') {
		parent.style.position = 'relative';
	}
};

const releaseParent = (parent: HTMLElement): void => {
	const existing = parentRecords.get(parent);
	if (!existing) return;

	existing.count -= 1;
	if (existing.count > 0) return;

	parent.style.position = existing.position;
	parentRecords.delete(parent);
};

const readOverlayTypography = (target: HTMLElement): OverlayTypography => {
	const style = getComputedStyle(target);

	return {
		color: style.color,
		direction: style.direction,
		font: style.font,
		fontFeatureSettings: style.fontFeatureSettings,
		fontKerning: style.fontKerning,
		fontVariant: style.fontVariant,
		fontVariationSettings: style.fontVariationSettings,
		letterSpacing: style.letterSpacing,
		lineHeight: style.lineHeight,
		textAlign: style.textAlign,
		textTransform: style.textTransform,
		wordSpacing: style.wordSpacing,
	};
};

const writeOverlayTypography = (overlay: HTMLElement, typography: OverlayTypography): void => {
	overlay.style.color = typography.color;
	overlay.style.direction = typography.direction;
	overlay.style.font = typography.font;
	overlay.style.fontFeatureSettings = typography.fontFeatureSettings;
	overlay.style.fontKerning = typography.fontKerning;
	overlay.style.fontVariant = typography.fontVariant;
	overlay.style.fontVariationSettings = typography.fontVariationSettings;
	overlay.style.letterSpacing = typography.letterSpacing;
	overlay.style.lineHeight = typography.lineHeight;
	overlay.style.textAlign = typography.textAlign;
	overlay.style.textTransform = typography.textTransform;
	overlay.style.wordSpacing = typography.wordSpacing;
};

const cloneTargetForLine = (target: HTMLElement, width: number, topOffset: number): HTMLElement => {
	const clone = sanitizeClone(target);
	clone.style.left = '0';
	clone.style.margin = '0';
	clone.style.maxWidth = 'none';
	clone.style.position = 'absolute';
	clone.style.top = px(-topOffset);
	clone.style.width = px(width);

	return clone;
};

const appendLine = (overlay: HTMLElement, target: HTMLElement, line: Line, targetRect: Rect, index: number, delayMs: number): void => {
	const mask = document.createElement('span');
	const inner = document.createElement('span');
	const slice = document.createElement('span');
	const lineTop = line.rect.top - targetRect.top - OVERLAY_EDGE_PAD;
	const lineHeight = line.rect.height + OVERLAY_EDGE_PAD * 2;

	mask.className = 'line-reveal-mask';
	mask.style.left = '0';
	mask.style.top = px(lineTop);
	mask.style.width = px(targetRect.width);
	mask.style.height = px(lineHeight);
	mask.style.setProperty('--line-reveal-index', String(index));
	mask.style.setProperty('--line-reveal-delay', `${Math.round(delayMs)}ms`);

	inner.className = 'line-reveal-inner';
	inner.style.width = px(targetRect.width);
	inner.style.height = px(lineHeight);
	slice.className = 'line-reveal-slice';
	slice.style.width = px(targetRect.width);
	slice.style.height = px(lineHeight);
	slice.append(cloneTargetForLine(target, targetRect.width, lineTop));

	inner.append(slice);
	mask.append(inner);
	overlay.append(mask);
};

export const measureLineReveal = (target: HTMLElement, options: LineRevealOptions): MeasuredLineReveal | undefined => {
	if (!shouldPrepareLineReveal(target, options)) return undefined;
	if (target.dataset['lineRevealState'] === 'complete' || target.dataset['lineRevealState'] === 'fallback') return undefined;

	const parent = target.parentElement;
	if (!parent) return undefined;

	const start = performance.now();
	const tokens: Token[] = [];
	collectTokens(target, tokens);

	if (tokens.length === 0 || tokens.length > options.maxTokens) {
		throw new Error('line-reveal-token-budget');
	}

	const lines = groupTokensIntoLines(tokens);
	if (lines.length === 0 || lines.length > options.maxLinesPerTarget) {
		throw new Error('line-reveal-line-budget');
	}

	if (performance.now() - start > options.measureBudgetMs) {
		throw new Error('line-reveal-measure-budget');
	}

	const targetRect = toRect(target.getBoundingClientRect());
	const parentRect = toRect(parent.getBoundingClientRect());
	if (!isVisibleRect(targetRect)) return undefined;

	const maxStaggerWindow = Math.max(0, options.maxTotalMs - options.durationMs);
	const delayOffsetMs = options.delayOffsetMs ?? 0;
	const actualStagger = lines.length > 1 ? Math.min(options.staggerMs, maxStaggerWindow / (lines.length - 1)) : 0;
	const animationMs = options.durationMs + delayOffsetMs + actualStagger * Math.max(0, lines.length - 1) + 80;

	return {
		target,
		parent,
		targetRect,
		parentRect,
		parentClientLeft: parent.clientLeft,
		parentClientTop: parent.clientTop,
		parentScrollLeft: parent.scrollLeft,
		parentScrollTop: parent.scrollTop,
		parentInlinePosition: parent.style.position,
		parentComputedPosition: getComputedStyle(parent).position,
		typography: readOverlayTypography(target),
		lines,
		lineCount: lines.length,
		options,
		actualStagger,
		delayOffsetMs,
		lineDelaysMs: lines.map((_, index) => delayOffsetMs + index * actualStagger),
		animationMs,
		handoffMs: options.handoffMs,
		totalMs: animationMs + options.handoffMs,
	};
};

export const mountLineReveal = (measured: MeasuredLineReveal): PreparedLineReveal => {
	const { target, parent, targetRect, parentRect, lines, actualStagger, delayOffsetMs, lineDelaysMs, animationMs, handoffMs, totalMs } = measured;
	const overlay = document.createElement('span');
	const fragment = document.createDocumentFragment();

	overlay.className = 'line-reveal-overlay';
	overlay.setAttribute('aria-hidden', 'true');
	overlay.dataset['lineRevealOverlay'] = 'true';
	overlay.dataset['lineRevealState'] = 'ready';
	overlay.style.left = px(targetRect.left - parentRect.left - measured.parentClientLeft + measured.parentScrollLeft);
	overlay.style.top = px(targetRect.top - parentRect.top - measured.parentClientTop + measured.parentScrollTop);
	overlay.style.width = px(targetRect.width);
	overlay.style.height = px(targetRect.height);
	writeOverlayTypography(overlay, measured.typography);

	lines.forEach((line, index) => appendLine(overlay, target, line, targetRect, index, lineDelaysMs[index] ?? delayOffsetMs + index * actualStagger));

	fragment.append(overlay);
	retainParent(parent, measured.parentInlinePosition, measured.parentComputedPosition);
	parent.append(fragment);

	const originalOpacity = target.style.opacity;
	target.dataset['lineRevealState'] = 'ready';
	target.style.opacity = '0';

	let finishHandle: number | undefined;
	let handoffHandle: number | undefined;
	let isDone = false;

	const clearFinishHandle = (): void => {
		if (finishHandle === undefined) return;
		window.clearTimeout(finishHandle);
		finishHandle = undefined;
	};

	const restore = (state: 'complete' | 'fallback'): void => {
		if (isDone) return;
		isDone = true;
		clearFinishHandle();
		target.style.opacity = originalOpacity;
		target.dataset['lineRevealState'] = state;

		const removeOverlay = (): void => {
			overlay.remove();
			releaseParent(parent);
		};

		if (state === 'complete') {
			overlay.dataset['lineRevealState'] = 'settling';
			handoffHandle = window.setTimeout(removeOverlay, handoffMs);
			return;
		}

		if (handoffHandle !== undefined) {
			window.clearTimeout(handoffHandle);
		}

		removeOverlay();
	};

	return {
		target,
		overlay,
		lineCount: lines.length,
		animationMs,
		totalMs,
		width: targetRect.width,
		play: () => {
			if (isDone || target.dataset['lineRevealState'] === 'running') return;

			target.dataset['lineRevealState'] = 'running';
			overlay.dataset['lineRevealState'] = 'running';
			finishHandle = window.setTimeout(() => restore('complete'), animationMs);
		},
		cancel: () => restore('fallback'),
		complete: () => restore('complete'),
	};
};

export const cancelPreparedLineReveal = (prepared: PreparedLineReveal | undefined): void => {
	prepared?.cancel();
};
