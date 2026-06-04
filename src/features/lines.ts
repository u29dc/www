import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { getDeviceProfile, getLineRevealProfile, initDeviceProfile, subscribeDeviceProfile } from '../lib/device';
import { initLinePlanCache } from '../lib/cache';
import { cancelPreparedLineReveal, measureLineReveal, mountLineReveal, type LineRevealOptions, type LineRevealProfile, type MeasuredLineReveal, type PreparedLineReveal } from '../lib/lines';
import { MOTION, readDurationToken, readNumberToken } from '../lib/motion';

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

initDeviceProfile();
initLinePlanCache();
const preparedTargets = new Map<HTMLElement, PreparedLineReveal>();
const queuedSequences = new Set<PreparedLineReveal[]>();
const sequenceFinishHandles = new Set<number>();
let targetWidths = new WeakMap<HTMLElement, number>();
let sequenceTargets = new WeakMap<HTMLElement, HTMLElement[]>();
let queuedSequenceRoots = new WeakMap<PreparedLineReveal[], HTMLElement>();

let intersectionObserver: IntersectionObserver | undefined;
let mutationObserver: MutationObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let abortController = new AbortController();
let totalLineCount = 0;
let activeTargetCount = 0;
let observeFrame: number | undefined;
let hasObservedCurrentDocument = false;
let activeLineProfileKey = `${getDeviceProfile().motionQuality}:${getDeviceProfile().lineProfile}`;

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
	if (milliseconds <= 0 || signal.aborted) return Promise.resolve();

	return new Promise((resolve) => {
		let timeout = 0;
		const finish = (): void => {
			window.clearTimeout(timeout);
			signal.removeEventListener('abort', finish);
			resolve();
		};

		timeout = window.setTimeout(finish, milliseconds);
		signal.addEventListener('abort', finish, { once: true });
	});
};

const waitForFonts = async (signal: AbortSignal): Promise<void> => {
	const fonts = document.fonts;
	if (!fonts) return;

	await Promise.race([fonts.ready.then(() => undefined), delay(MOTION.line.fontWaitMs, signal)]);
};

const nextFrame = (signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		let timeout = 0;
		let frame = 0;
		const finish = (): void => {
			window.clearTimeout(timeout);
			window.cancelAnimationFrame(frame);
			signal.removeEventListener('abort', finish);
			resolve();
		};

		timeout = window.setTimeout(finish, MOTION.line.frameWaitMs);
		frame = window.requestAnimationFrame(finish);
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
	preparedTargets.delete(prepared.target);
	resizeObserver?.unobserve(prepared.target);
};

const cancelPrepared = (prepared: PreparedLineReveal): void => {
	untrackPrepared(prepared);
	cancelPreparedLineReveal(prepared);
};

const cancelAllPrepared = (): void => {
	for (const prepared of preparedTargets.values()) {
		cancelPreparedLineReveal(prepared);
	}

	preparedTargets.clear();
	queuedSequences.clear();
	for (const handle of sequenceFinishHandles) {
		window.clearTimeout(handle);
	}
	sequenceFinishHandles.clear();
	targetWidths = new WeakMap<HTMLElement, number>();
	sequenceTargets = new WeakMap<HTMLElement, HTMLElement[]>();
	queuedSequenceRoots = new WeakMap<PreparedLineReveal[], HTMLElement>();
	totalLineCount = 0;
	activeTargetCount = 0;
	resizeObserver?.disconnect();
};

const ensureMutationObserver = (): void => {
	if (mutationObserver) return;

	mutationObserver = new MutationObserver(() => {
		for (const sequence of Array.from(queuedSequences)) {
			const first = sequence[0];
			if (!first || !first.target.isConnected) {
				cancelSequence(sequence);
				continue;
			}

			if (isRevealGateOpen(first.target)) {
				queuedSequences.delete(sequence);
				playSequence(sequence, queuedSequenceRoots.get(sequence) ?? first.target);
			}
		}
	});

	mutationObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-reveal'],
		subtree: true,
	});
};

const observePreparedWidth = (prepared: PreparedLineReveal): void => {
	resizeObserver ??= new ResizeObserver((entries) => {
		for (const entry of entries) {
			const target = entry.target;
			if (!(target instanceof HTMLElement)) continue;

			const lastWidth = targetWidths.get(target);
			const nextWidth = entry.contentRect.width;
			if (lastWidth === undefined || Math.abs(lastWidth - nextWidth) < MOTION.line.widthChangeTolerancePx) continue;

			const preparedTarget = preparedTargets.get(target);
			if (preparedTarget) {
				cancelPrepared(preparedTarget);
			}
		}
	});

	targetWidths.set(prepared.target, prepared.width);
	resizeObserver.observe(prepared.target);
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
	window.requestAnimationFrame(() => {
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

		const groupHandle = window.setTimeout(
			() => {
				sequenceFinishHandles.delete(groupHandle);
				if (root.isConnected) {
					markLineGroupComplete(root);
				}
			},
			Math.max(0, maxAnimationMs - MOTION.line.groupFollowOverlapMs),
		);
		sequenceFinishHandles.add(groupHandle);

		const cleanupHandle = window.setTimeout(() => {
			sequenceFinishHandles.delete(cleanupHandle);

			for (const prepared of sequence) {
				untrackPrepared(prepared);
			}
		}, maxTotalMs + MOTION.line.groupCompleteBufferMs);
		sequenceFinishHandles.add(cleanupHandle);
	});
}

const cancelSequence = (sequence: PreparedLineReveal[]): void => {
	queuedSequences.delete(sequence);
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

	queuedSequences.add(sequence);
	queuedSequenceRoots.set(sequence, root);
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
		if (activeTargetCount >= MOTION.line.maxTargets) {
			fallbackTargets.push(target);
			continue;
		}

		try {
			const measured = measureLineReveal(target, lineOptions);
			if (!measured) {
				fallbackTargets.push(target);
				continue;
			}

			if (totalLineCount + measured.lineCount > MOTION.line.maxTotalLines) {
				fallbackTargets.push(target);
				continue;
			}

			totalLineCount += measured.lineCount;
			activeTargetCount += 1;
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
		preparedTargets.set(measured.target, prepared);
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
	if (hasObservedCurrentDocument) return;

	hasObservedCurrentDocument = true;
	intersectionObserver?.disconnect();
	mutationObserver?.disconnect();
	mutationObserver = undefined;
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

	abortController.abort();
	abortController = new AbortController();
	const { signal } = abortController;

	intersectionObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;

				intersectionObserver?.unobserve(entry.target);
				void prepareSequence(entry.target, sequenceTargets.get(entry.target) ?? [], signal, { waitForLayout: true }).catch(() => {
					if (!signal.aborted) fallbackLineRevealDocument();
				});
			}
		},
		{ rootMargin: MOTION.line.rootMargin, threshold: MOTION.line.threshold },
	);

	const sequences = getSequences();
	sequences.forEach((sequence) => {
		markLineGroupPending(sequence.root);
		sequenceTargets.set(sequence.root, sequence.targets);
		for (const target of sequence.targets) {
			markLineTargetPending(target);
		}

		if (observeOptions.immediateVisible && isInViewport(sequence.root)) {
			void prepareSequence(sequence.root, sequence.targets, signal, { waitForLayout: observeOptions.waitForLayout ?? false }).catch(() => {
				if (!signal.aborted) fallbackLineRevealDocument();
			});
			return;
		}

		intersectionObserver?.observe(sequence.root);
	});
};

const scheduleObserveTargets = (): void => {
	if (observeFrame !== undefined) {
		window.cancelAnimationFrame(observeFrame);
	}

	observeFrame = window.requestAnimationFrame(() => {
		observeFrame = undefined;
		runSafely(observeTargets);
	});
};

const cleanup = (): void => {
	hasObservedCurrentDocument = false;

	if (observeFrame !== undefined) {
		window.cancelAnimationFrame(observeFrame);
		observeFrame = undefined;
	}

	abortController.abort();
	intersectionObserver?.disconnect();
	mutationObserver?.disconnect();
	mutationObserver = undefined;
	cancelAllPrepared();
};

const handleBeforeSwap = (event: TransitionBeforeSwapEvent): void => {
	cleanup();
	const swap = event.swap;
	event.swap = () => {
		swap();
		runSafely(() => observeTargets({ immediateVisible: true, waitForLayout: false }));
	};
};

document.addEventListener('astro:before-swap', (event) => {
	const transitionEvent = event as TransitionBeforeSwapEvent;
	runSafely(() => handleBeforeSwap(transitionEvent), transitionEvent.newDocument);
});
document.addEventListener('astro:page-load', () => runSafely(scheduleObserveTargets));
subscribeDeviceProfile((profile) => {
	const nextLineProfileKey = `${profile.motionQuality}:${profile.lineProfile}`;
	if (nextLineProfileKey === activeLineProfileKey) return;
	activeLineProfileKey = nextLineProfileKey;
	runSafely(() => {
		cleanup();
		scheduleObserveTargets();
	});
});

runSafely(() => {
	prepareLineRevealDocument();
	scheduleObserveTargets();
});
