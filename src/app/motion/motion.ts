import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from '../device/device';
import { onNextFrame } from '../runtime/loop';
import { createTask } from '../runtime/task';
import { delayTimer, setTimer, type TimerHandle } from '../runtime/timer';
import { onRouteAbort, onRouteAfterSwap, onRouteBeforeSwap, onRouteLoad, onRoutePreparation, type RoutePreparation, type RouteSwap } from '../route/route';
import { MOTION, readDurationToken } from './tokens';

const REVEAL_TARGET_SELECTOR = ['[data-reveal]', '[data-reveal-group] > :where(header, section, article, footer, h1, h2, h3, p, ul, ol, dl, figure, blockquote, div, li)'].join(',');
const COMPLETE_LINE_GROUPS_DATASET_KEY = 'lineRevealCompleteGroups';
const LINE_GROUP_COMPLETE_EVENT = 'line-reveal-group-complete';

const state = {
	initialized: false,
	reduceMotionQuery: window.matchMedia('(prefers-reduced-motion: reduce)'),
	activeCanAnimate: getDeviceProfile().motionQuality !== 'reduced',
	revealObserver: undefined as IntersectionObserver | undefined,
	revealFallbackHandle: undefined as TimerHandle | undefined,
	lineGroupRevealHandles: new Map<string, TimerHandle>(),
	exitAbortCleanup: undefined as (() => void) | undefined,
	siteRouteMotionHandle: undefined as TimerHandle | undefined,
	panelIntroHandle: undefined as TimerHandle | undefined,
	panelIntroFrameCancel: undefined as (() => void) | undefined,
	cleanups: [] as Array<() => void>,
};

export const motion = createTask({
	name: 'motion',
	order: 40,
	state,
	preinit() {
		bindMotion();
	},
	init() {
		syncSiteRoute();
		startPanelIntro();
		initializeReveals();
	},
	dispose() {
		for (const cleanup of state.cleanups.splice(0)) cleanup();
		clearRevealFallback();
		clearLineGroupRevealHandles();
		clearExitState();
		clearSiteRouteMotion();
		state.revealObserver?.disconnect();
		state.revealObserver = undefined;
		state.initialized = false;
	},
});

const canAnimate = (): boolean => getDeviceProfile().motionQuality !== 'reduced';
const isPageExiting = (): boolean => document.documentElement.dataset['pageState'] === 'exiting';

const readSiteRoute = (url: URL | Location = window.location): 'home' | 'detail' => (url.pathname === '/' ? 'home' : 'detail');

const setSiteRoute = (route: 'home' | 'detail'): void => {
	document.documentElement.dataset['siteRoute'] = route;
};

const syncSiteRoute = (): void => {
	setSiteRoute(readSiteRoute());
};

const clearSiteRouteMotion = (): void => {
	if (state.siteRouteMotionHandle !== undefined) {
		state.siteRouteMotionHandle.cancel();
		state.siteRouteMotionHandle = undefined;
	}

	delete document.documentElement.dataset['siteRouteMotion'];
};

const finishPanelIntro = (): void => {
	state.panelIntroFrameCancel?.();
	state.panelIntroFrameCancel = undefined;

	if (state.panelIntroHandle !== undefined) {
		state.panelIntroHandle.cancel();
		state.panelIntroHandle = undefined;
	}

	document.documentElement.dataset['panelIntro'] = 'done';
};

const startPanelIntro = (): void => {
	if (!canAnimate()) {
		finishPanelIntro();
		return;
	}

	const root = document.documentElement;
	if (root.dataset['panelIntro'] !== 'pending') return;

	state.panelIntroFrameCancel = onNextFrame('motion.panel.start', () => {
		state.panelIntroFrameCancel = undefined;
		if (root.dataset['panelIntro'] !== 'pending') return;

		root.dataset['panelIntro'] = 'running';
		const durationMs = readDurationToken('--duration-panel-intro', MOTION.panelIntroMs);
		const delayMs = readDurationToken('--delay-panel-intro', MOTION.panelIntroDelayMs);

		state.panelIntroHandle = setTimer('motion.panel.complete', durationMs + delayMs + MOTION.panelIntroBufferMs, finishPanelIntro);
	});
};

const startSiteRouteMotion = (): void => {
	if (!canAnimate()) return;

	clearSiteRouteMotion();
	document.documentElement.dataset['siteRouteMotion'] = 'running';

	const finish = (): void => {
		clearSiteRouteMotion();
	};

	state.siteRouteMotionHandle = setTimer('motion.route.complete', readDurationToken('--duration-page-exit', MOTION.pageExitMs) + MOTION.siteRouteMotionBufferMs, finish);
};

const delay = (milliseconds: number, signal?: AbortSignal): Promise<void> => {
	return delayTimer('motion.delay', milliseconds, signal);
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

		target.style.setProperty('--reveal-index', String(Math.min(index, MOTION.revealMaxIndex)));
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
	if (state.revealFallbackHandle === undefined) return;

	state.revealFallbackHandle.cancel();
	state.revealFallbackHandle = undefined;
};

const clearLineGroupRevealHandles = (): void => {
	for (const handle of state.lineGroupRevealHandles.values()) {
		handle.cancel();
	}

	state.lineGroupRevealHandles.clear();
};

const hasPendingRevealTargets = (): boolean => getRevealTargets().some((target) => target.dataset['reveal'] === 'pending');

const reveal = (target: HTMLElement): void => {
	if (isPageExiting()) {
		state.revealObserver?.unobserve(target);
		return;
	}

	if (shouldWaitForLineGroup(target)) {
		target.dataset['reveal'] = 'waiting';
		state.revealObserver?.unobserve(target);
		return;
	}

	target.dataset['reveal'] = 'visible';
	state.revealObserver?.unobserve(target);

	if (!hasPendingRevealTargets()) clearRevealFallback();
};

const revealTargetsWaitingForLineGroup = (group: string): void => {
	const targets = getRevealTargets().filter((target) => target.dataset['reveal'] === 'waiting' && target.dataset['revealAfterLineGroup'] === group);

	targets.forEach((target, index) => {
		target.style.setProperty('--reveal-index', String(Math.min(index, MOTION.revealMaxIndex)));
		reveal(target);
	});
};

const scheduleRevealTargetsWaitingForLineGroup = (group: string): void => {
	if (isPageExiting()) return;

	const existingHandle = state.lineGroupRevealHandles.get(group);
	if (existingHandle !== undefined) {
		existingHandle.cancel();
	}

	const delayMs = readDurationToken('--duration-line-reveal-follow-delay', MOTION.lineGroupRevealDelayMs);
	const handle = setTimer('motion.line-group.reveal', delayMs, () => {
		state.lineGroupRevealHandles.delete(group);
		revealTargetsWaitingForLineGroup(group);
	});

	state.lineGroupRevealHandles.set(group, handle);
};

const revealPendingTargets = (): void => {
	for (const target of getRevealTargets()) {
		if (target.dataset['reveal'] === 'pending') reveal(target);
	}
};

const observeRevealTargets = (): void => {
	state.revealObserver?.disconnect();
	clearRevealFallback();

	const targets = getRevealTargets().filter((target) => target.dataset['reveal'] === 'pending');

	if (targets.length === 0) return;

	if (!canAnimate()) {
		for (const target of targets) reveal(target);
		return;
	}

	state.revealObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.target instanceof HTMLElement) {
					reveal(entry.target);
				}
			}
		},
		{ rootMargin: MOTION.revealRootMargin, threshold: MOTION.revealThreshold },
	);

	for (const target of targets) {
		state.revealObserver.observe(target);
	}

	state.revealFallbackHandle = setTimer('motion.reveal.fallback', MOTION.revealFallbackMs, () => {
		state.revealFallbackHandle = undefined;
		revealPendingTargets();
	});
};

const initializeReveals = (): void => {
	clearRevealFallback();
	clearLineGroupRevealHandles();
	prepareRevealTargets();
	observeRevealTargets();
};

const clearExitState = (): void => {
	delete document.documentElement.dataset['pageState'];
	state.exitAbortCleanup?.();
	state.exitAbortCleanup = undefined;
};

const playExit = (signal: AbortSignal): Promise<void> => {
	if (!canAnimate()) return Promise.resolve();

	state.exitAbortCleanup?.();
	document.documentElement.dataset['pageState'] = 'exiting';
	clearRevealFallback();
	clearLineGroupRevealHandles();

	const abort = (): void => clearExitState();
	signal.addEventListener('abort', abort, { once: true });
	state.exitAbortCleanup = () => signal.removeEventListener('abort', abort);

	return delay(readDurationToken('--duration-page-exit', MOTION.pageExitMs), signal);
};

const handleBeforePreparation = (event: RoutePreparation): Promise<void> => {
	if (event.previousRoute !== event.nextRoute) {
		setSiteRoute(event.nextRoute);
		startSiteRouteMotion();
	}

	return playExit(event.signal);
};

const handleRouteAbort = (): void => {
	clearExitState();
	clearSiteRouteMotion();
	syncSiteRoute();
};

const handleBeforeSwap = (event: RouteSwap): void => {
	delete event.newDocument.documentElement.dataset['pageState'];
	event.newDocument.documentElement.dataset['panelIntro'] = 'done';
	prepareRevealTargets(event.newDocument);
};

const bindMotion = (): void => {
	if (state.initialized) return;
	state.initialized = true;

	initDeviceProfile();
	state.cleanups.push(onRoutePreparation(handleBeforePreparation));
	state.cleanups.push(onRouteBeforeSwap(handleBeforeSwap));
	state.cleanups.push(onRouteAfterSwap(clearExitState));
	state.cleanups.push(onRouteAbort(handleRouteAbort));
	state.cleanups.push(
		onRouteLoad(() => {
			syncSiteRoute();
			initializeReveals();
		}),
	);
	const handleLineGroupComplete = (event: Event): void => {
		const group = event instanceof CustomEvent && typeof event.detail?.group === 'string' ? event.detail.group : undefined;
		if (group) scheduleRevealTargetsWaitingForLineGroup(group);
	};
	document.addEventListener(LINE_GROUP_COMPLETE_EVENT, handleLineGroupComplete);
	state.cleanups.push(() => document.removeEventListener(LINE_GROUP_COMPLETE_EVENT, handleLineGroupComplete));
	const handleReducedMotion = (): void => {
		finishPanelIntro();
		initializeReveals();
	};
	state.reduceMotionQuery.addEventListener('change', handleReducedMotion);
	state.cleanups.push(() => state.reduceMotionQuery.removeEventListener('change', handleReducedMotion));
	state.cleanups.push(
		subscribeDeviceProfile((profile) => {
			const nextCanAnimate = profile.motionQuality !== 'reduced';
			if (nextCanAnimate === state.activeCanAnimate) return;
			state.activeCanAnimate = nextCanAnimate;
			if (!nextCanAnimate) {
				finishPanelIntro();
			}
			initializeReveals();
		}),
	);
};
