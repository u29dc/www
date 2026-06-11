import { getDeviceProfile, getLineRevealProfile, initDeviceProfile, subscribeDeviceProfile } from '../device/device';
import { onNextFrame } from '../runtime/loop';
import { createTask } from '../runtime/task';
import { delayTimer, setTimer, type TimerHandle } from '../runtime/timer';
import { onRouteBeforeSwap, onRouteLoad, type RouteSwap } from '../route/route';
import { initLinePlanCache } from './cache';
import { cancelPreparedLineReveal, measureLineReveal, mountLineReveal, type LineRevealOptions, type LineRevealProfile, type MeasuredLineReveal, type PreparedLineReveal } from './measure';
import { MOTION, readDurationToken, readNumberToken } from '../motion/tokens';

const TARGET_SELECTOR = '[data-line-reveal]';
const GROUP_SELECTOR = '[data-line-reveal-group]';
const COMPLETE_GROUPS_DATASET_KEY = 'lineRevealCompleteGroups';
const GROUP_COMPLETE_EVENT = 'line-reveal-group-complete';
const LINE_BOOT_DATASET_KEY = 'lineRevealBoot';

type LineRevealState = 'pending' | 'ready' | 'running' | 'complete' | 'fallback';
type LineRevealBootState = 'pending' | 'ready' | 'reduced' | 'failed';
type ObserveTargetsOptions = {
	immediateVisible?: boolean;
	waitForLayout?: boolean;
};

const lineState = {
	preparedTargets: new Map<HTMLElement, PreparedLineReveal>(),
	queuedSequences: new Set<PreparedLineReveal[]>(),
	sequenceFinishHandles: new Set<TimerHandle>(),
	sequenceFrameCancels: new Set<() => void>(),
	targetWidths: new WeakMap<HTMLElement, number>(),
	sequenceTargets: new WeakMap<HTMLElement, HTMLElement[]>(),
	queuedSequenceRoots: new WeakMap<PreparedLineReveal[], HTMLElement>(),
	intersectionObserver: undefined as IntersectionObserver | undefined,
	mutationObserver: undefined as MutationObserver | undefined,
	resizeObserver: undefined as ResizeObserver | undefined,
	abortController: new AbortController(),
	totalLineCount: 0,
	activeTargetCount: 0,
	observeFrameCancel: undefined as (() => void) | undefined,
	observedCurrentDocument: false,
	activeProfileKey: `${getDeviceProfile().motionQuality}:${getDeviceProfile().lineProfile}`,
	initialized: false,
	cleanups: [] as Array<() => void>,
};

export const lines = createTask({
	name: 'lines',
	order: 50,
	state: lineState,
	preinit() {
		bindLines();
	},
	init() {
		runSafely(() => {
			prepareLineRevealDocument();
			scheduleObserveTargets();
		});
	},
	dispose() {
		for (const cleanup of lineState.cleanups.splice(0)) cleanup();
		cleanup();
		lineState.initialized = false;
	},
});

const readLineState = (target: HTMLElement): LineRevealState | undefined => {
	const state = target.dataset['lineRevealState'];
	if (state === 'pending' || state === 'ready' || state === 'running' || state === 'complete' || state === 'fallback') return state;
	return undefined;
};

const isPendingLineTarget = (target: HTMLElement): boolean => {
	const state = readLineState(target);
	return state === undefined || state === 'pending';
};

const isTerminalLineTarget = (target: HTMLElement): boolean => {
	const state = readLineState(target);
	return state === 'complete' || state === 'fallback';
};

const markLineBoot = (root: Document | Element, state: LineRevealBootState): void => {
	const doc = root instanceof Document ? root : root.ownerDocument;
	doc.documentElement.dataset[LINE_BOOT_DATASET_KEY] = state;
};

const isLineTarget = (element: Element): element is HTMLElement => element instanceof HTMLElement && !element.closest('[hidden], [aria-hidden="true"], [data-no-line-reveal]');

const getLineTargets = (root: Document | Element = document): HTMLElement[] => {
	const targets: HTMLElement[] = root instanceof HTMLElement && root.matches(TARGET_SELECTOR) ? [root] : [];

	for (const target of Array.from(root.querySelectorAll(TARGET_SELECTOR))) {
		if (isLineTarget(target)) targets.push(target);
	}

	return targets;
};

const getLineGroups = (root: Document | Element = document): HTMLElement[] => {
	const groups: HTMLElement[] = root instanceof HTMLElement && root.matches(GROUP_SELECTOR) ? [root] : [];

	for (const group of Array.from(root.querySelectorAll(GROUP_SELECTOR))) {
		if (group instanceof HTMLElement) groups.push(group);
	}

	return groups;
};

const fallbackLineRevealDocument = (root: Document | Element = document): void => {
	const doc = root instanceof Document ? root : root.ownerDocument;
	for (const target of getLineTargets(root)) {
		if (!isTerminalLineTarget(target)) markFallback(target);
	}
	for (const group of getLineGroups(root)) {
		markLineGroupComplete(group);
	}
	markLineBoot(doc, 'failed');
};

const runSafely = (callback: () => void, fallbackRoot: Document | Element = document): void => {
	try {
		callback();
	} catch {
		fallbackLineRevealDocument(fallbackRoot);
	}
};

const markLineTargetPending = (target: HTMLElement): void => {
	if (isTerminalLineTarget(target)) return;

	target.dataset['lineRevealState'] = 'pending';
	target.style.opacity = '';
};

const prepareLineRevealDocument = (root: Document | Element = document): void => {
	const canAnimateLines = getDeviceProfile().motionQuality !== 'reduced';
	for (const group of getLineGroups(root)) {
		markLineGroupPending(group);
	}

	for (const target of getLineTargets(root)) {
		if (canAnimateLines) {
			markLineTargetPending(target);
		} else {
			markFallback(target);
		}
	}

	markLineBoot(root, canAnimateLines ? 'ready' : 'reduced');
};

const readCompletedGroups = (doc: Document = document): Set<string> => new Set((doc.documentElement.dataset[COMPLETE_GROUPS_DATASET_KEY] ?? '').split(' ').filter(Boolean));

const writeCompletedGroups = (groups: Set<string>, doc: Document = document): void => {
	const value = Array.from(groups).toSorted().join(' ');

	if (value) {
		doc.documentElement.dataset[COMPLETE_GROUPS_DATASET_KEY] = value;
		return;
	}

	delete doc.documentElement.dataset[COMPLETE_GROUPS_DATASET_KEY];
};

function markLineGroupPending(root: HTMLElement): void {
	const group = root.dataset['lineRevealGroup'];
	if (!group) return;
	const doc = root.ownerDocument;

	root.dataset['lineRevealGroupState'] = 'pending';
	const groups = readCompletedGroups(doc);
	groups.delete(group);
	writeCompletedGroups(groups, doc);
}

function markLineGroupComplete(root: HTMLElement): void {
	const group = root.dataset['lineRevealGroup'];
	if (!group) return;
	const doc = root.ownerDocument;

	root.dataset['lineRevealGroupState'] = 'complete';
	const groups = readCompletedGroups(doc);
	groups.add(group);
	writeCompletedGroups(groups, doc);
	doc.dispatchEvent(new CustomEvent(GROUP_COMPLETE_EVENT, { detail: { group } }));
}

const getProfile = (): LineRevealProfile | undefined => {
	const profile = getDeviceProfile();
	if (profile.motionQuality === 'reduced') return undefined;
	return getLineRevealProfile(profile);
};

const getOptions = (): LineRevealOptions | undefined => {
	const profile = getProfile();
	if (!profile) return undefined;

	return {
		profile,
		durationMs: readDurationToken('--duration-line-reveal', MOTION.line.durationMs),
		staggerMs: readDurationToken('--duration-line-reveal-stagger', MOTION.line.staggerMs),
		maxTotalMs: readDurationToken('--duration-line-reveal-max', MOTION.line.maxTotalMs),
		handoffMs: readDurationToken('--duration-line-reveal-handoff', MOTION.line.handoffMs),
		staggeredLines: readNumberToken('--line-reveal-staggered-lines', MOTION.line.staggeredLines),
		completionBufferMs: MOTION.line.completionBufferMs,
		maxTokens: profile === 'full' ? MOTION.line.fullMaxTokens : MOTION.line.liteMaxTokens,
		maxLinesPerTarget: profile === 'full' ? MOTION.line.fullMaxLinesPerTarget : MOTION.line.liteMaxLinesPerTarget,
		measureBudgetMs: profile === 'full' ? Number.POSITIVE_INFINITY : MOTION.line.liteMeasureBudgetMs,
	};
};

const delay = (milliseconds: number, signal: AbortSignal): Promise<void> => {
	return delayTimer('lines.delay', milliseconds, signal);
};

const waitForFonts = async (signal: AbortSignal): Promise<void> => {
	const fonts = document.fonts;
	if (!fonts) return;

	await Promise.race([fonts.ready.then(() => undefined), delay(MOTION.line.fontWaitMs, signal)]);
};

const nextFrame = (signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		let timeout: TimerHandle | undefined;
		let cancelFrame: (() => void) | undefined;
		const finish = (): void => {
			timeout?.cancel();
			cancelFrame?.();
			signal.removeEventListener('abort', finish);
			resolve();
		};

		timeout = setTimer('lines.next-frame.fallback', MOTION.line.frameWaitMs, finish, { signal });
		cancelFrame = onNextFrame('lines.next-frame', finish);
		signal.addEventListener('abort', finish, { once: true });
	});

const isInViewport = (element: HTMLElement): boolean => {
	const rect = element.getBoundingClientRect();
	const height = window.innerHeight || document.documentElement.clientHeight;
	const width = window.innerWidth || document.documentElement.clientWidth;

	return rect.bottom >= 0 && rect.right >= 0 && rect.top <= height && rect.left <= width;
};

const getRevealGate = (target: HTMLElement): HTMLElement | undefined => {
	const gate = target.closest('[data-reveal]');
	return gate instanceof HTMLElement ? gate : undefined;
};

const isRevealGateOpen = (target: HTMLElement): boolean => {
	const gate = getRevealGate(target);
	return !gate || gate.dataset['reveal'] === 'visible';
};

function markFallback(target: HTMLElement): void {
	target.dataset['lineRevealState'] = 'fallback';
	target.style.opacity = '';
}

const untrackPrepared = (prepared: PreparedLineReveal): void => {
	lineState.preparedTargets.delete(prepared.target);
	lineState.resizeObserver?.unobserve(prepared.target);
};

const cancelPrepared = (prepared: PreparedLineReveal): void => {
	untrackPrepared(prepared);
	cancelPreparedLineReveal(prepared);
};

const cancelAllPrepared = (): void => {
	for (const prepared of lineState.preparedTargets.values()) {
		cancelPreparedLineReveal(prepared);
	}

	lineState.preparedTargets.clear();
	lineState.queuedSequences.clear();
	for (const handle of lineState.sequenceFinishHandles) {
		handle.cancel();
	}
	lineState.sequenceFinishHandles.clear();
	for (const cancel of lineState.sequenceFrameCancels) {
		cancel();
	}
	lineState.sequenceFrameCancels.clear();
	lineState.targetWidths = new WeakMap<HTMLElement, number>();
	lineState.sequenceTargets = new WeakMap<HTMLElement, HTMLElement[]>();
	lineState.queuedSequenceRoots = new WeakMap<PreparedLineReveal[], HTMLElement>();
	lineState.totalLineCount = 0;
	lineState.activeTargetCount = 0;
	lineState.resizeObserver?.disconnect();
};

const ensureMutationObserver = (): void => {
	if (lineState.mutationObserver) return;

	lineState.mutationObserver = new MutationObserver(() => {
		for (const sequence of Array.from(lineState.queuedSequences)) {
			const first = sequence[0];
			if (!first || !first.target.isConnected) {
				cancelSequence(sequence);
				continue;
			}

			if (isRevealGateOpen(first.target)) {
				lineState.queuedSequences.delete(sequence);
				playSequence(sequence, lineState.queuedSequenceRoots.get(sequence) ?? first.target);
			}
		}
	});

	lineState.mutationObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-reveal'],
		subtree: true,
	});
};

const observePreparedWidth = (prepared: PreparedLineReveal): void => {
	lineState.resizeObserver ??= new ResizeObserver((entries) => {
		for (const entry of entries) {
			const target = entry.target;
			if (!(target instanceof HTMLElement)) continue;

			const lastWidth = lineState.targetWidths.get(target);
			const nextWidth = entry.contentRect.width;
			if (lastWidth === undefined || Math.abs(lastWidth - nextWidth) < MOTION.line.widthChangeTolerancePx) continue;

			const preparedTarget = lineState.preparedTargets.get(target);
			if (preparedTarget) {
				cancelPrepared(preparedTarget);
			}
		}
	});

	lineState.targetWidths.set(prepared.target, prepared.width);
	lineState.resizeObserver.observe(prepared.target);
};

const applySequenceTiming = (sequence: MeasuredLineReveal[], options: LineRevealOptions): void => {
	const lineCount = sequence.reduce((sum, measured) => sum + measured.lineCount, 0);
	const staggeredLineCount = Math.min(lineCount, Math.max(0, Math.floor(options.staggeredLines)));
	const maxStaggerWindow = Math.max(0, options.maxTotalMs - options.durationMs);
	const sequenceStagger = staggeredLineCount > 1 ? Math.min(options.staggerMs, maxStaggerWindow / (staggeredLineCount - 1)) : 0;
	let lineIndex = 0;

	for (const measured of sequence) {
		const lineDelaysMs = measured.lines.map(() => {
			const delayIndex = staggeredLineCount > 0 ? Math.min(lineIndex, staggeredLineCount - 1) : 0;
			lineIndex += 1;
			return delayIndex * sequenceStagger;
		});
		const maxDelayMs = Math.max(0, ...lineDelaysMs);

		measured.actualStagger = sequenceStagger;
		measured.delayOffsetMs = lineDelaysMs[0] ?? 0;
		measured.lineDelaysMs = lineDelaysMs;
		measured.animationMs = options.durationMs + maxDelayMs + options.completionBufferMs;
		measured.totalMs = measured.animationMs + options.handoffMs;
	}
};

function playSequence(sequence: PreparedLineReveal[], root: HTMLElement): void {
	const cancelFrame = onNextFrame('lines.play', () => {
		lineState.sequenceFrameCancels.delete(cancelFrame);
		let maxAnimationMs = 0;
		let maxTotalMs = 0;

		for (const prepared of sequence) {
			if (!prepared.target.isConnected) {
				cancelPrepared(prepared);
				continue;
			}

			prepared.play();
			maxAnimationMs = Math.max(maxAnimationMs, prepared.animationMs);
			maxTotalMs = Math.max(maxTotalMs, prepared.totalMs);
		}

		const groupHandle = setTimer('lines.group.complete', Math.max(0, maxAnimationMs - MOTION.line.groupFollowOverlapMs), () => {
			lineState.sequenceFinishHandles.delete(groupHandle);
			if (root.isConnected) {
				markLineGroupComplete(root);
			}
		});
		lineState.sequenceFinishHandles.add(groupHandle);

		const cleanupHandle = setTimer('lines.cleanup', maxTotalMs + MOTION.line.groupCompleteBufferMs, () => {
			lineState.sequenceFinishHandles.delete(cleanupHandle);

			for (const prepared of sequence) {
				untrackPrepared(prepared);
			}
		});
		lineState.sequenceFinishHandles.add(cleanupHandle);
	});
	lineState.sequenceFrameCancels.add(cancelFrame);
}

const cancelSequence = (sequence: PreparedLineReveal[]): void => {
	lineState.queuedSequences.delete(sequence);
	for (const prepared of sequence) {
		cancelPrepared(prepared);
	}
};

const queueOrPlay = (root: HTMLElement, sequence: PreparedLineReveal[]): void => {
	const first = sequence[0];
	if (!first) {
		markLineGroupComplete(root);
		return;
	}

	if (isRevealGateOpen(first.target)) {
		playSequence(sequence, root);
		return;
	}

	lineState.queuedSequences.add(sequence);
	lineState.queuedSequenceRoots.set(sequence, root);
	ensureMutationObserver();
};

const prepareSequence = async (root: HTMLElement, targets: HTMLElement[], signal: AbortSignal, options: { waitForLayout: boolean }): Promise<void> => {
	const pendingTargets = targets.filter(isPendingLineTarget);
	if (pendingTargets.length === 0) {
		markLineGroupComplete(root);
		return;
	}

	const lineOptions = getOptions();
	if (!lineOptions) {
		for (const target of pendingTargets) markFallback(target);
		markLineGroupComplete(root);
		return;
	}

	if (options.waitForLayout) {
		await waitForFonts(signal);
		await nextFrame(signal);
	}

	if (signal.aborted) return;

	const measuredSequence: MeasuredLineReveal[] = [];
	const fallbackTargets: HTMLElement[] = [];

	for (const target of pendingTargets) {
		if (signal.aborted || !target.isConnected || !isPendingLineTarget(target)) continue;
		if (lineState.activeTargetCount >= MOTION.line.maxTargets) {
			fallbackTargets.push(target);
			continue;
		}

		try {
			const measured = measureLineReveal(target, lineOptions);
			if (!measured) {
				fallbackTargets.push(target);
				continue;
			}

			if (lineState.totalLineCount + measured.lineCount > MOTION.line.maxTotalLines) {
				fallbackTargets.push(target);
				continue;
			}

			lineState.totalLineCount += measured.lineCount;
			lineState.activeTargetCount += 1;
			measuredSequence.push(measured);
		} catch {
			fallbackTargets.push(target);
		}
	}

	for (const target of fallbackTargets) {
		markFallback(target);
	}

	applySequenceTiming(measuredSequence, lineOptions);

	const preparedSequence = measuredSequence.map((measured) => {
		const prepared = mountLineReveal(measured);
		lineState.preparedTargets.set(measured.target, prepared);
		observePreparedWidth(prepared);
		return prepared;
	});

	queueOrPlay(root, preparedSequence);
};

const getScopedTargets = (group: HTMLElement): HTMLElement[] => {
	const targets = new Set<HTMLElement>();

	for (const target of Array.from(group.querySelectorAll(TARGET_SELECTOR))) {
		if (target instanceof HTMLElement && target.closest(GROUP_SELECTOR) === group) {
			targets.add(target);
		}
	}

	return Array.from(targets);
};

const getSequences = (): Array<{ root: HTMLElement; targets: HTMLElement[] }> => {
	const sequences: Array<{ root: HTMLElement; targets: HTMLElement[] }> = [];
	const groupedTargets = new Set<HTMLElement>();

	for (const group of Array.from(document.querySelectorAll(GROUP_SELECTOR))) {
		if (!(group instanceof HTMLElement)) continue;

		const targets = getScopedTargets(group);
		if (targets.length === 0) continue;

		sequences.push({ root: group, targets });
		for (const target of targets) groupedTargets.add(target);
	}

	for (const target of Array.from(document.querySelectorAll(TARGET_SELECTOR))) {
		if (!(target instanceof HTMLElement) || groupedTargets.has(target)) continue;
		sequences.push({ root: target, targets: [target] });
	}

	return sequences;
};

const observeTargets = (observeOptions: ObserveTargetsOptions = {}): void => {
	if (lineState.observedCurrentDocument) return;

	lineState.observedCurrentDocument = true;
	lineState.intersectionObserver?.disconnect();
	lineState.mutationObserver?.disconnect();
	lineState.mutationObserver = undefined;
	cancelAllPrepared();
	prepareLineRevealDocument();

	const options = getOptions();
	if (!options) {
		for (const { root, targets } of getSequences()) {
			for (const target of targets) markFallback(target);
			markLineGroupComplete(root);
		}
		return;
	}

	lineState.abortController.abort();
	lineState.abortController = new AbortController();
	const { signal } = lineState.abortController;

	lineState.intersectionObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;

				lineState.intersectionObserver?.unobserve(entry.target);
				void prepareSequence(entry.target, lineState.sequenceTargets.get(entry.target) ?? [], signal, { waitForLayout: true }).catch(() => {
					if (!signal.aborted) fallbackLineRevealDocument();
				});
			}
		},
		{ rootMargin: MOTION.line.rootMargin, threshold: MOTION.line.threshold },
	);

	const sequences = getSequences();
	sequences.forEach((sequence) => {
		markLineGroupPending(sequence.root);
		lineState.sequenceTargets.set(sequence.root, sequence.targets);
		for (const target of sequence.targets) {
			markLineTargetPending(target);
		}

		if (observeOptions.immediateVisible && isInViewport(sequence.root)) {
			void prepareSequence(sequence.root, sequence.targets, signal, { waitForLayout: observeOptions.waitForLayout ?? false }).catch(() => {
				if (!signal.aborted) fallbackLineRevealDocument();
			});
			return;
		}

		lineState.intersectionObserver?.observe(sequence.root);
	});
};

const scheduleObserveTargets = (): void => {
	lineState.observeFrameCancel?.();

	lineState.observeFrameCancel = onNextFrame('lines.observe', () => {
		lineState.observeFrameCancel = undefined;
		runSafely(observeTargets);
	});
};

const cleanup = (): void => {
	lineState.observedCurrentDocument = false;

	lineState.observeFrameCancel?.();
	lineState.observeFrameCancel = undefined;

	lineState.abortController.abort();
	lineState.intersectionObserver?.disconnect();
	lineState.mutationObserver?.disconnect();
	lineState.mutationObserver = undefined;
	cancelAllPrepared();
};

const handleBeforeSwap = (event: RouteSwap): void => {
	cleanup();
	event.wrapSwap((swap) => {
		swap();
		runSafely(() => observeTargets({ immediateVisible: true, waitForLayout: false }));
	});
};

const bindLines = (): void => {
	if (lineState.initialized) return;
	lineState.initialized = true;

	initDeviceProfile();
	initLinePlanCache();
	lineState.cleanups.push(
		onRouteBeforeSwap((event) => {
			runSafely(() => handleBeforeSwap(event), event.newDocument);
		}),
	);
	lineState.cleanups.push(onRouteLoad(() => runSafely(scheduleObserveTargets)));
	lineState.cleanups.push(
		subscribeDeviceProfile((profile) => {
			const nextLineProfileKey = `${profile.motionQuality}:${profile.lineProfile}`;
			if (nextLineProfileKey === lineState.activeProfileKey) return;
			lineState.activeProfileKey = nextLineProfileKey;
			runSafely(() => {
				cleanup();
				scheduleObserveTargets();
			});
		}),
	);
};
