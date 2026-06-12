import { onNextFrame } from '../core/loop';
import { AppOwner, type Context } from '../core/owner';
import type { SiteRoute } from '../core/state';
import { delayTimer, setTimer, type TimerHandle } from '../core/timer';
import { MOTION, readDurationToken } from '../core/tokens';
import { getDeviceProfile, initDeviceProfile, subscribeDeviceProfile } from './device';
import { onRouteAbort, onRouteAfterSwap, onRouteBeforeSwap, onRouteLoad, onRoutePreparation, type RoutePreparation, type RouteSwap } from './route';

const REVEAL_TARGET_SELECTOR = ['[data-reveal]', '[data-reveal-group] > :where(header, section, article, footer, h1, h2, h3, p, ul, ol, dl, figure, blockquote, div, li)'].join(',');
const COMPLETE_LINE_GROUPS_DATASET_KEY = 'lineRevealCompleteGroups';
const LINE_GROUP_COMPLETE_EVENT = 'line-reveal-group-complete';

class MotionOwner extends AppOwner {
	readonly name = 'motion';
	override readonly order = 40;

	private initialized = false;
	private readonly reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	private activeCanAnimate = getDeviceProfile().motionQuality !== 'reduced';
	private revealObserver: IntersectionObserver | undefined;
	private revealFallbackHandle: TimerHandle | undefined;
	private readonly lineGroupRevealHandles = new Map<string, TimerHandle>();
	private exitAbortCleanup: (() => void) | undefined;
	private siteRouteMotionHandle: TimerHandle | undefined;
	private panelIntroHandle: TimerHandle | undefined;
	private panelIntroFrameCancel: (() => void) | undefined;

	override preinit(context: Context): void {
		super.preinit(context);
		this.bind();
	}

	init(): void {
		this.syncSiteRoute();
		this.startPanelIntro();
		this.initializeReveals();
	}

	override dispose(): void {
		super.dispose();
		this.clearRevealFallback();
		this.clearLineGroupRevealHandles();
		this.clearExitState();
		this.clearSiteRouteMotion();
		this.revealObserver?.disconnect();
		this.revealObserver = undefined;
		this.initialized = false;
	}

	private bind(): void {
		if (this.initialized) return;
		this.initialized = true;

		initDeviceProfile();
		this.addCleanup(onRoutePreparation(this.handleBeforePreparation));
		this.addCleanup(onRouteBeforeSwap(this.handleBeforeSwap));
		this.addCleanup(onRouteAfterSwap(this.clearExitState));
		this.addCleanup(onRouteAbort(this.handleRouteAbort));
		this.addCleanup(
			onRouteLoad(() => {
				this.syncSiteRoute();
				this.initializeReveals();
			}),
		);
		document.addEventListener(LINE_GROUP_COMPLETE_EVENT, this.handleLineGroupComplete);
		this.addCleanup(() => document.removeEventListener(LINE_GROUP_COMPLETE_EVENT, this.handleLineGroupComplete));
		this.reduceMotionQuery.addEventListener('change', this.handleReducedMotion);
		this.addCleanup(() => this.reduceMotionQuery.removeEventListener('change', this.handleReducedMotion));
		this.addCleanup(
			subscribeDeviceProfile((profile) => {
				const nextCanAnimate = profile.motionQuality !== 'reduced';
				if (nextCanAnimate === this.activeCanAnimate) return;
				this.activeCanAnimate = nextCanAnimate;
				if (!nextCanAnimate) {
					this.finishPanelIntro();
				}
				this.initializeReveals();
			}),
		);
	}

	private canAnimate(): boolean {
		return getDeviceProfile().motionQuality !== 'reduced';
	}

	private isPageExiting(): boolean {
		return document.documentElement.dataset['pageState'] === 'exiting';
	}

	private readSiteRoute(url: URL | Location = window.location): SiteRoute {
		return url.pathname === '/' ? 'home' : 'detail';
	}

	private setSiteRoute(route: SiteRoute): void {
		document.documentElement.dataset['siteRoute'] = route;
	}

	private syncSiteRoute(): void {
		this.setSiteRoute(this.readSiteRoute());
	}

	private clearSiteRouteMotion(): void {
		if (this.siteRouteMotionHandle !== undefined) {
			this.siteRouteMotionHandle.cancel();
			this.siteRouteMotionHandle = undefined;
		}

		delete document.documentElement.dataset['siteRouteMotion'];
	}

	private finishPanelIntro(): void {
		this.panelIntroFrameCancel?.();
		this.panelIntroFrameCancel = undefined;

		if (this.panelIntroHandle !== undefined) {
			this.panelIntroHandle.cancel();
			this.panelIntroHandle = undefined;
		}

		document.documentElement.dataset['panelIntro'] = 'done';
	}

	private startPanelIntro(): void {
		if (!this.canAnimate()) {
			this.finishPanelIntro();
			return;
		}

		const root = document.documentElement;
		if (root.dataset['panelIntro'] !== 'pending') return;

		this.panelIntroFrameCancel = onNextFrame('motion.panel.start', () => {
			this.panelIntroFrameCancel = undefined;
			if (root.dataset['panelIntro'] !== 'pending') return;

			root.dataset['panelIntro'] = 'running';
			const durationMs = readDurationToken('--duration-panel-intro', MOTION.panelIntroMs);
			const delayMs = readDurationToken('--delay-panel-intro', MOTION.panelIntroDelayMs);

			this.panelIntroHandle = setTimer('motion.panel.complete', durationMs + delayMs + MOTION.panelIntroBufferMs, () => this.finishPanelIntro());
		});
	}

	private startSiteRouteMotion(): void {
		if (!this.canAnimate()) return;

		this.clearSiteRouteMotion();
		document.documentElement.dataset['siteRouteMotion'] = 'running';

		this.siteRouteMotionHandle = setTimer('motion.route.complete', readDurationToken('--duration-page-exit', MOTION.pageExitMs) + MOTION.siteRouteMotionBufferMs, () => {
			this.clearSiteRouteMotion();
		});
	}

	private delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
		return delayTimer('motion.delay', milliseconds, signal);
	}

	private isRevealTarget(element: Element): element is HTMLElement {
		return element instanceof HTMLElement && !element.closest('[hidden], [aria-hidden="true"], [data-no-reveal]');
	}

	private getRevealTargets(root: Document | Element = document): HTMLElement[] {
		return Array.from(root.querySelectorAll(REVEAL_TARGET_SELECTOR)).filter((element): element is HTMLElement => this.isRevealTarget(element));
	}

	private getCompletedLineGroups(): Set<string> {
		return new Set((document.documentElement.dataset[COMPLETE_LINE_GROUPS_DATASET_KEY] ?? '').split(' ').filter(Boolean));
	}

	private shouldWaitForLineGroup(target: HTMLElement): boolean {
		const group = target.dataset['revealAfterLineGroup'];
		return Boolean(group && this.canAnimate() && !this.getCompletedLineGroups().has(group));
	}

	private assignRevealIndexes(targets: HTMLElement[]): void {
		const groupIndexes = new WeakMap<Element, number>();
		let looseIndex = 0;

		for (const target of targets) {
			if (target.hasAttribute('data-reveal-once') && target.dataset['reveal'] === 'visible') {
				continue;
			}

			const parentGroup = target.parentElement?.matches('[data-reveal-group]') ? target.parentElement : undefined;
			const index = parentGroup ? (groupIndexes.get(parentGroup) ?? 0) : looseIndex;

			target.style.setProperty('--reveal-index', String(Math.min(index, MOTION.revealMaxIndex)));
			target.dataset['reveal'] = this.canAnimate() ? 'pending' : 'visible';

			if (parentGroup) {
				groupIndexes.set(parentGroup, index + 1);
			} else {
				looseIndex += 1;
			}
		}
	}

	private prepareRevealTargets(root: Document | Element = document): void {
		const doc = root instanceof Document ? root : root.ownerDocument;
		doc.documentElement.dataset['motion'] = this.canAnimate() ? 'ready' : 'reduced';
		doc.documentElement.dataset['motionBoot'] = 'ready';
		this.assignRevealIndexes(this.getRevealTargets(root));
	}

	private clearRevealFallback(): void {
		if (this.revealFallbackHandle === undefined) return;

		this.revealFallbackHandle.cancel();
		this.revealFallbackHandle = undefined;
	}

	private clearLineGroupRevealHandles(): void {
		for (const handle of this.lineGroupRevealHandles.values()) {
			handle.cancel();
		}

		this.lineGroupRevealHandles.clear();
	}

	private hasPendingRevealTargets(): boolean {
		return this.getRevealTargets().some((target) => target.dataset['reveal'] === 'pending');
	}

	private reveal(target: HTMLElement): void {
		if (this.isPageExiting()) {
			this.revealObserver?.unobserve(target);
			return;
		}

		if (this.shouldWaitForLineGroup(target)) {
			target.dataset['reveal'] = 'waiting';
			this.revealObserver?.unobserve(target);
			return;
		}

		target.dataset['reveal'] = 'visible';
		this.revealObserver?.unobserve(target);

		if (!this.hasPendingRevealTargets()) this.clearRevealFallback();
	}

	private revealTargetsWaitingForLineGroup(group: string): void {
		const targets = this.getRevealTargets().filter((target) => target.dataset['reveal'] === 'waiting' && target.dataset['revealAfterLineGroup'] === group);

		targets.forEach((target, index) => {
			target.style.setProperty('--reveal-index', String(Math.min(index, MOTION.revealMaxIndex)));
			this.reveal(target);
		});
	}

	private scheduleRevealTargetsWaitingForLineGroup(group: string): void {
		if (this.isPageExiting()) return;

		const existingHandle = this.lineGroupRevealHandles.get(group);
		if (existingHandle !== undefined) {
			existingHandle.cancel();
		}

		const delayMs = readDurationToken('--duration-line-reveal-follow-delay', MOTION.lineGroupRevealDelayMs);
		const handle = setTimer('motion.line-group.reveal', delayMs, () => {
			this.lineGroupRevealHandles.delete(group);
			this.revealTargetsWaitingForLineGroup(group);
		});

		this.lineGroupRevealHandles.set(group, handle);
	}

	private revealPendingTargets(): void {
		for (const target of this.getRevealTargets()) {
			if (target.dataset['reveal'] === 'pending') this.reveal(target);
		}
	}

	private observeRevealTargets(): void {
		this.revealObserver?.disconnect();
		this.clearRevealFallback();

		const targets = this.getRevealTargets().filter((target) => target.dataset['reveal'] === 'pending');

		if (targets.length === 0) return;

		if (!this.canAnimate()) {
			for (const target of targets) this.reveal(target);
			return;
		}

		this.revealObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target instanceof HTMLElement) {
						this.reveal(entry.target);
					}
				}
			},
			{ rootMargin: MOTION.revealRootMargin, threshold: MOTION.revealThreshold },
		);

		for (const target of targets) {
			this.revealObserver.observe(target);
		}

		this.revealFallbackHandle = setTimer('motion.reveal.fallback', MOTION.revealFallbackMs, () => {
			this.revealFallbackHandle = undefined;
			this.revealPendingTargets();
		});
	}

	private initializeReveals(): void {
		this.clearRevealFallback();
		this.clearLineGroupRevealHandles();
		this.prepareRevealTargets();
		this.observeRevealTargets();
	}

	private readonly clearExitState = (): void => {
		delete document.documentElement.dataset['pageState'];
		this.exitAbortCleanup?.();
		this.exitAbortCleanup = undefined;
	};

	private playExit(signal: AbortSignal): Promise<void> {
		if (!this.canAnimate()) return Promise.resolve();

		this.exitAbortCleanup?.();
		document.documentElement.dataset['pageState'] = 'exiting';
		this.clearRevealFallback();
		this.clearLineGroupRevealHandles();

		const abort = (): void => this.clearExitState();
		signal.addEventListener('abort', abort, { once: true });
		this.exitAbortCleanup = () => signal.removeEventListener('abort', abort);

		return this.delay(readDurationToken('--duration-page-exit', MOTION.pageExitMs), signal);
	}

	private readonly handleBeforePreparation = (event: RoutePreparation): Promise<void> => {
		if (event.previousRoute !== event.nextRoute) {
			this.setSiteRoute(event.nextRoute);
			this.startSiteRouteMotion();
		}

		return this.playExit(event.signal);
	};

	private readonly handleRouteAbort = (): void => {
		this.clearExitState();
		this.clearSiteRouteMotion();
		this.syncSiteRoute();
	};

	private readonly handleBeforeSwap = (event: RouteSwap): void => {
		delete event.newDocument.documentElement.dataset['pageState'];
		event.newDocument.documentElement.dataset['panelIntro'] = 'done';
		this.prepareRevealTargets(event.newDocument);
	};

	private readonly handleLineGroupComplete = (event: Event): void => {
		const group = event instanceof CustomEvent && typeof event.detail?.group === 'string' ? event.detail.group : undefined;
		if (group) this.scheduleRevealTargetsWaitingForLineGroup(group);
	};

	private readonly handleReducedMotion = (): void => {
		this.finishPanelIntro();
		this.initializeReveals();
	};
}

export const motion = new MotionOwner();
