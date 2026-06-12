import { onNextFrame } from '../core/loop';
import { AppOwner, type Context } from '../core/owner';
import { delayTimer, setTimer, type TimerHandle } from '../core/timer';
import { MOTION, readDurationToken, readNumberToken } from '../core/tokens';
import { getDeviceProfile, getLineRevealProfile, initDeviceProfile, subscribeDeviceProfile } from '../systems/device';
import { onRouteBeforeSwap, onRouteLoad, type RouteSwap } from '../systems/route';
import {
	cancelPreparedLineReveal,
	initLinePlanCache,
	measureLineReveal,
	mountLineReveal,
	type LineRevealOptions,
	type LineRevealProfile,
	type MeasuredLineReveal,
	type PreparedLineReveal,
} from './measure';

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

class LinesOwner extends AppOwner {
	readonly name = 'lines';
	override readonly order = 50;

	private preparedTargets = new Map<HTMLElement, PreparedLineReveal>();
	private queuedSequences = new Set<PreparedLineReveal[]>();
	private sequenceFinishHandles = new Set<TimerHandle>();
	private sequenceFrameCancels = new Set<() => void>();
	private targetWidths = new WeakMap<HTMLElement, number>();
	private sequenceTargets = new WeakMap<HTMLElement, HTMLElement[]>();
	private queuedSequenceRoots = new WeakMap<PreparedLineReveal[], HTMLElement>();
	private intersectionObserver: IntersectionObserver | undefined;
	private mutationObserver: MutationObserver | undefined;
	private resizeObserver: ResizeObserver | undefined;
	private abortController = new AbortController();
	private totalLineCount = 0;
	private activeTargetCount = 0;
	private observeFrameCancel: (() => void) | undefined;
	private observedCurrentDocument = false;
	private activeProfileKey = readLineProfileKey();
	private initialized = false;

	override preinit(context: Context): void {
		super.preinit(context);
		this.bind();
	}

	init(): void {
		this.runSafely(() => {
			this.prepareDocument();
			this.scheduleObserveTargets();
		});
	}

	override dispose(): void {
		super.dispose();
		this.cleanup();
		this.initialized = false;
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		initLinePlanCache();
		this.addCleanup(onRouteBeforeSwap(this.handleBeforeSwap));
		this.addCleanup(onRouteLoad(() => this.runSafely(() => this.scheduleObserveTargets())));
		this.addCleanup(
			subscribeDeviceProfile((profile) => {
				const nextLineProfileKey = `${profile.motionQuality}:${profile.lineProfile}`;
				if (nextLineProfileKey === this.activeProfileKey) return;
				this.activeProfileKey = nextLineProfileKey;
				this.runSafely(() => {
					this.cleanup();
					this.scheduleObserveTargets();
				});
			}),
		);
	}

	private prepareDocument(root: Document | Element = document): void {
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
	}

	private observeTargets(observeOptions: ObserveTargetsOptions = {}): void {
		if (this.observedCurrentDocument) return;

		this.observedCurrentDocument = true;
		this.intersectionObserver?.disconnect();
		this.mutationObserver?.disconnect();
		this.mutationObserver = undefined;
		this.cancelAllPrepared();
		this.prepareDocument();

		const options = getOptions();
		if (!options) {
			for (const { root, targets } of getSequences()) {
				for (const target of targets) markFallback(target);
				markLineGroupComplete(root);
			}
			return;
		}

		this.abortController.abort();
		this.abortController = new AbortController();
		const { signal } = this.abortController;

		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;

					this.intersectionObserver?.unobserve(entry.target);
					void this.prepareSequence(entry.target, this.sequenceTargets.get(entry.target) ?? [], signal, { waitForLayout: true }).catch(() => {
						if (!signal.aborted) this.fallbackDocument();
					});
				}
			},
			{ rootMargin: MOTION.line.rootMargin, threshold: MOTION.line.threshold },
		);

		for (const sequence of getSequences()) {
			markLineGroupPending(sequence.root);
			this.sequenceTargets.set(sequence.root, sequence.targets);
			for (const target of sequence.targets) {
				markLineTargetPending(target);
			}

			if (observeOptions.immediateVisible && isInViewport(sequence.root)) {
				void this.prepareSequence(sequence.root, sequence.targets, signal, { waitForLayout: observeOptions.waitForLayout ?? false }).catch(() => {
					if (!signal.aborted) this.fallbackDocument();
				});
				continue;
			}

			this.intersectionObserver?.observe(sequence.root);
		}
	}

	private scheduleObserveTargets(): void {
		this.observeFrameCancel?.();

		this.observeFrameCancel = onNextFrame('lines.observe', () => {
			this.observeFrameCancel = undefined;
			this.runSafely(() => this.observeTargets());
		});
	}

	private async prepareSequence(root: HTMLElement, targets: HTMLElement[], signal: AbortSignal, options: { waitForLayout: boolean }): Promise<void> {
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
			if (this.activeTargetCount >= MOTION.line.maxTargets) {
				fallbackTargets.push(target);
				continue;
			}

			try {
				const measured = measureLineReveal(target, lineOptions);
				if (!measured) {
					fallbackTargets.push(target);
					continue;
				}

				if (this.totalLineCount + measured.lineCount > MOTION.line.maxTotalLines) {
					fallbackTargets.push(target);
					continue;
				}

				this.totalLineCount += measured.lineCount;
				this.activeTargetCount += 1;
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
			this.preparedTargets.set(measured.target, prepared);
			this.observePreparedWidth(prepared);
			return prepared;
		});

		this.queueOrPlay(root, preparedSequence);
	}

	private queueOrPlay(root: HTMLElement, sequence: PreparedLineReveal[]): void {
		const first = sequence[0];
		if (!first) {
			markLineGroupComplete(root);
			return;
		}

		if (isRevealGateOpen(first.target)) {
			this.playSequence(sequence, root);
			return;
		}

		this.queuedSequences.add(sequence);
		this.queuedSequenceRoots.set(sequence, root);
		this.ensureMutationObserver();
	}

	private playSequence(sequence: PreparedLineReveal[], root: HTMLElement): void {
		const cancelFrame = onNextFrame('lines.play', () => {
			this.sequenceFrameCancels.delete(cancelFrame);
			let maxAnimationMs = 0;
			let maxTotalMs = 0;

			for (const prepared of sequence) {
				if (!prepared.target.isConnected) {
					this.cancelPrepared(prepared);
					continue;
				}

				prepared.play();
				maxAnimationMs = Math.max(maxAnimationMs, prepared.animationMs);
				maxTotalMs = Math.max(maxTotalMs, prepared.totalMs);
			}

			const groupHandle = setTimer('lines.group.complete', Math.max(0, maxAnimationMs - MOTION.line.groupFollowOverlapMs), () => {
				this.sequenceFinishHandles.delete(groupHandle);
				if (root.isConnected) {
					markLineGroupComplete(root);
				}
			});
			this.sequenceFinishHandles.add(groupHandle);

			const cleanupHandle = setTimer('lines.cleanup', maxTotalMs + MOTION.line.groupCompleteBufferMs, () => {
				this.sequenceFinishHandles.delete(cleanupHandle);

				for (const prepared of sequence) {
					this.untrackPrepared(prepared);
				}
			});
			this.sequenceFinishHandles.add(cleanupHandle);
		});
		this.sequenceFrameCancels.add(cancelFrame);
	}

	private ensureMutationObserver(): void {
		if (this.mutationObserver) return;

		this.mutationObserver = new MutationObserver(() => {
			for (const sequence of Array.from(this.queuedSequences)) {
				const first = sequence[0];
				if (!first || !first.target.isConnected) {
					this.cancelSequence(sequence);
					continue;
				}

				if (isRevealGateOpen(first.target)) {
					this.queuedSequences.delete(sequence);
					this.playSequence(sequence, this.queuedSequenceRoots.get(sequence) ?? first.target);
				}
			}
		});

		this.mutationObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-reveal'],
			subtree: true,
		});
	}

	private observePreparedWidth(prepared: PreparedLineReveal): void {
		this.resizeObserver ??= new ResizeObserver((entries) => {
			for (const entry of entries) {
				const target = entry.target;
				if (!(target instanceof HTMLElement)) continue;

				const lastWidth = this.targetWidths.get(target);
				const nextWidth = entry.contentRect.width;
				if (lastWidth === undefined || Math.abs(lastWidth - nextWidth) < MOTION.line.widthChangeTolerancePx) continue;

				const preparedTarget = this.preparedTargets.get(target);
				if (preparedTarget) {
					this.cancelPrepared(preparedTarget);
				}
			}
		});

		this.targetWidths.set(prepared.target, prepared.width);
		this.resizeObserver.observe(prepared.target);
	}

	private cancelSequence(sequence: PreparedLineReveal[]): void {
		this.queuedSequences.delete(sequence);
		for (const prepared of sequence) {
			this.cancelPrepared(prepared);
		}
	}

	private cancelPrepared(prepared: PreparedLineReveal): void {
		this.untrackPrepared(prepared);
		cancelPreparedLineReveal(prepared);
	}

	private untrackPrepared(prepared: PreparedLineReveal): void {
		this.preparedTargets.delete(prepared.target);
		this.resizeObserver?.unobserve(prepared.target);
	}

	private cancelAllPrepared(): void {
		for (const prepared of this.preparedTargets.values()) {
			cancelPreparedLineReveal(prepared);
		}

		this.preparedTargets.clear();
		this.queuedSequences.clear();
		for (const handle of this.sequenceFinishHandles) {
			handle.cancel();
		}
		this.sequenceFinishHandles.clear();
		for (const cancel of this.sequenceFrameCancels) {
			cancel();
		}
		this.sequenceFrameCancels.clear();
		this.targetWidths = new WeakMap<HTMLElement, number>();
		this.sequenceTargets = new WeakMap<HTMLElement, HTMLElement[]>();
		this.queuedSequenceRoots = new WeakMap<PreparedLineReveal[], HTMLElement>();
		this.totalLineCount = 0;
		this.activeTargetCount = 0;
		this.resizeObserver?.disconnect();
	}

	private cleanup(): void {
		this.observedCurrentDocument = false;

		this.observeFrameCancel?.();
		this.observeFrameCancel = undefined;

		this.abortController.abort();
		this.intersectionObserver?.disconnect();
		this.mutationObserver?.disconnect();
		this.mutationObserver = undefined;
		this.cancelAllPrepared();
	}

	private readonly handleBeforeSwap = (event: RouteSwap): void => {
		this.runSafely(() => {
			this.cleanup();
			this.prepareDocument(event.newDocument);
		}, event.newDocument);
	};

	private fallbackDocument(root: Document | Element = document): void {
		for (const target of getLineTargets(root)) {
			if (!isTerminalLineTarget(target)) markFallback(target);
		}
		for (const group of getLineGroups(root)) {
			markLineGroupComplete(group);
		}
		markLineBoot(root, 'failed');
	}

	private runSafely(callback: () => void, fallbackRoot: Document | Element = document): void {
		try {
			callback();
		} catch {
			this.fallbackDocument(fallbackRoot);
		}
	}
}

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

const markLineTargetPending = (target: HTMLElement): void => {
	if (isTerminalLineTarget(target)) return;

	target.dataset['lineRevealState'] = 'pending';
	target.style.opacity = '';
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

const readLineProfileKey = (): string => {
	const profile = getDeviceProfile();
	return `${profile.motionQuality}:${profile.lineProfile}`;
};

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

const delay = (milliseconds: number, signal: AbortSignal): Promise<void> => delayTimer('lines.delay', milliseconds, signal);

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

export const lines = new LinesOwner();
