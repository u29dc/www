import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';

const DEFAULT_PAGE_EXIT_MS = 400;
const REVEAL_FALLBACK_MS = 1_500;
const REVEAL_ROOT_MARGIN = '0px 0px -8% 0px';
const REVEAL_THRESHOLD = 0.01;
const MAX_REVEAL_INDEX = 7;
const REVEAL_TARGET_SELECTOR = ['[data-reveal]', '[data-reveal-group] > :where(header, section, article, footer, h1, h2, h3, p, ul, ol, dl, figure, blockquote, div, li)'].join(',');
const SITE_ROUTE_MOTION_FALLBACK_MS = 500;
const SITE_ROUTE_MOTION_BUFFER_MS = 80;
const COMPLETE_LINE_GROUPS_DATASET_KEY = 'lineRevealCompleteGroups';
const LINE_GROUP_COMPLETE_EVENT = 'line-reveal-group-complete';
const LINE_GROUP_REVEAL_DELAY_MS = 0;

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver: IntersectionObserver | undefined;
let revealFallbackHandle: number | undefined;
let exitAbortCleanup: (() => void) | undefined;
let siteRouteMotionHandle: number | undefined;
const lineGroupRevealHandles = new Map<string, number>();

const canAnimate = (): boolean => !reduceMotionQuery.matches;

const readSiteRoute = (url: URL | Location = window.location): 'home' | 'detail' => (url.pathname === '/' ? 'home' : 'detail');

const setSiteRoute = (route: 'home' | 'detail'): void => {
	document.documentElement.dataset['siteRoute'] = route;
};

const syncSiteRoute = (): void => {
	setSiteRoute(readSiteRoute());
};

const clearSiteRouteMotion = (): void => {
	if (siteRouteMotionHandle !== undefined) {
		window.clearTimeout(siteRouteMotionHandle);
		siteRouteMotionHandle = undefined;
	}

	delete document.documentElement.dataset['siteRouteMotion'];
};

const startSiteRouteMotion = (): void => {
	if (!canAnimate()) return;

	clearSiteRouteMotion();
	document.documentElement.dataset['siteRouteMotion'] = 'running';

	const finish = (): void => {
		clearSiteRouteMotion();
	};

	siteRouteMotionHandle = window.setTimeout(finish, readDuration('--duration-page-exit', SITE_ROUTE_MOTION_FALLBACK_MS) + SITE_ROUTE_MOTION_BUFFER_MS);
};

const readDuration = (propertyName: string, fallbackMilliseconds: number): number => {
	const rawValue = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
	const value = Number.parseFloat(rawValue);

	if (!Number.isFinite(value)) return fallbackMilliseconds;
	if (rawValue.endsWith('ms')) return value;
	if (rawValue.endsWith('s')) return value * 1_000;

	return value;
};

const delay = (milliseconds: number, signal?: AbortSignal): Promise<void> => {
	if (milliseconds <= 0 || signal?.aborted) return Promise.resolve();

	return new Promise((resolve) => {
		let timeout = 0;
		const finish = (): void => {
			window.clearTimeout(timeout);
			signal?.removeEventListener('abort', finish);
			resolve();
		};

		timeout = window.setTimeout(finish, milliseconds);
		signal?.addEventListener('abort', finish, { once: true });
	});
};

const isRevealTarget = (element: Element): element is HTMLElement => element instanceof HTMLElement && !element.closest('[hidden], [aria-hidden="true"], [data-no-reveal]');

const getRevealTargets = (root: Document | Element = document): HTMLElement[] => Array.from(root.querySelectorAll(REVEAL_TARGET_SELECTOR)).filter(isRevealTarget);

const getCompletedLineGroups = (): Set<string> => new Set((document.documentElement.dataset[COMPLETE_LINE_GROUPS_DATASET_KEY] ?? '').split(' ').filter(Boolean));

const shouldWaitForLineGroup = (target: HTMLElement): boolean => {
	const group = target.dataset['revealAfterLineGroup'];
	return Boolean(group && canAnimate() && !getCompletedLineGroups().has(group));
};

const assignRevealIndexes = (targets: HTMLElement[]): void => {
	const groupIndexes = new WeakMap<Element, number>();
	let looseIndex = 0;

	for (const target of targets) {
		if (target.hasAttribute('data-reveal-once') && target.dataset['reveal'] === 'visible') {
			continue;
		}

		const parentGroup = target.parentElement?.matches('[data-reveal-group]') ? target.parentElement : undefined;
		const index = parentGroup ? (groupIndexes.get(parentGroup) ?? 0) : looseIndex;

		target.style.setProperty('--reveal-index', String(Math.min(index, MAX_REVEAL_INDEX)));
		target.dataset['reveal'] = canAnimate() ? 'pending' : 'visible';

		if (parentGroup) {
			groupIndexes.set(parentGroup, index + 1);
		} else {
			looseIndex += 1;
		}
	}
};

const prepareRevealTargets = (root: Document | Element = document): void => {
	const doc = root instanceof Document ? root : root.ownerDocument;
	doc.documentElement.dataset['motion'] = canAnimate() ? 'ready' : 'reduced';
	doc.documentElement.dataset['motionBoot'] = 'ready';
	assignRevealIndexes(getRevealTargets(root));
};

const clearRevealFallback = (): void => {
	if (revealFallbackHandle === undefined) return;

	window.clearTimeout(revealFallbackHandle);
	revealFallbackHandle = undefined;
};

const clearLineGroupRevealHandles = (): void => {
	for (const handle of lineGroupRevealHandles.values()) {
		window.clearTimeout(handle);
	}

	lineGroupRevealHandles.clear();
};

const hasPendingRevealTargets = (): boolean => getRevealTargets().some((target) => target.dataset['reveal'] === 'pending');

const reveal = (target: HTMLElement): void => {
	if (shouldWaitForLineGroup(target)) {
		target.dataset['reveal'] = 'waiting';
		revealObserver?.unobserve(target);
		return;
	}

	target.dataset['reveal'] = 'visible';
	revealObserver?.unobserve(target);

	if (!hasPendingRevealTargets()) clearRevealFallback();
};

const revealTargetsWaitingForLineGroup = (group: string): void => {
	const targets = getRevealTargets().filter((target) => target.dataset['reveal'] === 'waiting' && target.dataset['revealAfterLineGroup'] === group);

	targets.forEach((target, index) => {
		target.style.setProperty('--reveal-index', String(Math.min(index, MAX_REVEAL_INDEX)));
		reveal(target);
	});
};

const scheduleRevealTargetsWaitingForLineGroup = (group: string): void => {
	const existingHandle = lineGroupRevealHandles.get(group);
	if (existingHandle !== undefined) {
		window.clearTimeout(existingHandle);
	}

	const delayMs = readDuration('--duration-line-reveal-follow-delay', LINE_GROUP_REVEAL_DELAY_MS);
	const handle = window.setTimeout(() => {
		lineGroupRevealHandles.delete(group);
		revealTargetsWaitingForLineGroup(group);
	}, delayMs);

	lineGroupRevealHandles.set(group, handle);
};

const revealPendingTargets = (): void => {
	for (const target of getRevealTargets()) {
		if (target.dataset['reveal'] === 'pending') reveal(target);
	}
};

const observeRevealTargets = (): void => {
	revealObserver?.disconnect();
	clearRevealFallback();

	const targets = getRevealTargets().filter((target) => target.dataset['reveal'] === 'pending');

	if (targets.length === 0) return;

	if (!canAnimate()) {
		for (const target of targets) reveal(target);
		return;
	}

	revealObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.target instanceof HTMLElement) {
					reveal(entry.target);
				}
			}
		},
		{ rootMargin: REVEAL_ROOT_MARGIN, threshold: REVEAL_THRESHOLD },
	);

	for (const target of targets) {
		revealObserver.observe(target);
	}

	revealFallbackHandle = window.setTimeout(() => {
		revealFallbackHandle = undefined;
		revealPendingTargets();
	}, REVEAL_FALLBACK_MS);
};

const initializeReveals = (): void => {
	clearRevealFallback();
	clearLineGroupRevealHandles();
	prepareRevealTargets();
	observeRevealTargets();
};

const clearExitState = (): void => {
	delete document.documentElement.dataset['pageState'];
	exitAbortCleanup?.();
	exitAbortCleanup = undefined;
};

const playExit = (signal: AbortSignal): Promise<void> => {
	if (!canAnimate()) return Promise.resolve();

	exitAbortCleanup?.();
	document.documentElement.dataset['pageState'] = 'exiting';

	const abort = (): void => clearExitState();
	signal.addEventListener('abort', abort, { once: true });
	exitAbortCleanup = () => signal.removeEventListener('abort', abort);

	return delay(readDuration('--duration-page-exit', DEFAULT_PAGE_EXIT_MS), signal);
};

const handleBeforePreparation = (event: TransitionBeforePreparationEvent): void => {
	const originalLoader = event.loader;
	const previousRoute = document.documentElement.dataset['siteRoute'];
	const nextRoute = readSiteRoute(event.to);

	if (previousRoute !== nextRoute) {
		setSiteRoute(nextRoute);
		startSiteRouteMotion();
	}

	event.loader = async (): Promise<void> => {
		const exit = playExit(event.signal);
		try {
			await originalLoader();
			await exit;
		} catch (error) {
			clearExitState();
			clearSiteRouteMotion();
			syncSiteRoute();
			throw error;
		}
	};
};

const handleBeforeSwap = (event: TransitionBeforeSwapEvent): void => {
	delete event.newDocument.documentElement.dataset['pageState'];
	prepareRevealTargets(event.newDocument);
};

document.addEventListener('astro:before-preparation', (event) => {
	handleBeforePreparation(event as TransitionBeforePreparationEvent);
});

document.addEventListener('astro:before-swap', (event) => {
	handleBeforeSwap(event as TransitionBeforeSwapEvent);
});

document.addEventListener('astro:after-swap', clearExitState);
document.addEventListener(LINE_GROUP_COMPLETE_EVENT, (event) => {
	const group = event instanceof CustomEvent && typeof event.detail?.group === 'string' ? event.detail.group : undefined;
	if (group) scheduleRevealTargetsWaitingForLineGroup(group);
});
document.addEventListener('astro:page-load', () => {
	syncSiteRoute();
	initializeReveals();
});
reduceMotionQuery.addEventListener('change', initializeReveals);

syncSiteRoute();
initializeReveals();
