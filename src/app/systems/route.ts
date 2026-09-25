import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { BaseModule, type Context } from '../core/module';
import type { RoutePageState, RouteState, SiteRoute } from '../core/state';
import { setDataset } from '../utils/dom';

export type RoutePreparation = {
	id: number;
	to: URL;
	signal: AbortSignal;
	previousRoute: SiteRoute;
	nextRoute: SiteRoute;
	fromPathname: string;
	toPathname: string;
};

export type RouteSwap = {
	id: number;
	newDocument: Document;
	wrapSwap: (wrapper: (swap: () => void) => void) => void;
};

export type RouteEvent = {
	id: number;
};

export type RouteAbort = RouteEvent & {
	needsRefresh: boolean;
};

type PreparationHandler = (event: RoutePreparation) => void | Promise<void>;
type SwapHandler = (event: RouteSwap) => void;
type RouteHandler = (event: RouteEvent) => void;
type AbortHandler = (event: RouteAbort) => void;

class RouteOwner extends BaseModule {
	readonly name = 'route';

	private state: RouteState = createRouteState();
	private initialized = false;
	private readonly preparationHandlers = new Set<PreparationHandler>();
	private readonly beforeSwapHandlers = new Set<SwapHandler>();
	private readonly afterSwapHandlers = new Set<RouteHandler>();
	private readonly loadHandlers = new Set<RouteHandler>();
	private readonly abortHandlers = new Set<AbortHandler>();
	private nextTransitionId = 0;
	private activeTransitionId: number | undefined;
	private activeAbortCleanup: (() => void) | undefined;
	private cleanupTransitionId: number | undefined;
	private swappedTransitionId: number | undefined;
	private documentTransitionId = 0;
	private readonly transitionIds = new WeakMap<AbortSignal, number>();

	override preinit(context: Context): void {
		super.preinit(context);
		this.refreshState('idle');
		this.bindAstro();
		this.applyToDocument();
	}

	override init(): void {
		this.refreshState('idle');
		this.applyToDocument();
	}

	override dispose(): void {
		this.preparationHandlers.clear();
		this.beforeSwapHandlers.clear();
		this.afterSwapHandlers.clear();
		this.loadHandlers.clear();
		this.abortHandlers.clear();
		this.initialized = false;
		this.clearActiveTransition();
		this.swappedTransitionId = undefined;
		this.documentTransitionId = 0;
		this.nextTransitionId = 0;
		super.dispose();
	}

	getState(): RouteState {
		return { ...this.state };
	}

	setPageState(page: RoutePageState): void {
		this.state.page = page;
		this.state.pageState = page;
		this.applyToDocument();
		this.requestFrame(`route:${page}`);
	}

	syncLocation(): void {
		this.refreshState(this.state.page);
		this.applyToDocument();
		this.requestFrame('route:url');
	}

	onPreparation(handler: PreparationHandler): () => void {
		this.preparationHandlers.add(handler);
		return () => {
			this.preparationHandlers.delete(handler);
		};
	}

	onBeforeSwap(handler: SwapHandler): () => void {
		this.beforeSwapHandlers.add(handler);
		return () => {
			this.beforeSwapHandlers.delete(handler);
		};
	}

	onAfterSwap(handler: RouteHandler): () => void {
		this.afterSwapHandlers.add(handler);
		return () => {
			this.afterSwapHandlers.delete(handler);
		};
	}

	onLoad(handler: RouteHandler): () => void {
		this.loadHandlers.add(handler);
		return () => {
			this.loadHandlers.delete(handler);
		};
	}

	onAbort(handler: AbortHandler): () => void {
		this.abortHandlers.add(handler);
		return () => {
			this.abortHandlers.delete(handler);
		};
	}

	private readSiteRoute(url: URL | Location = window.location): SiteRoute {
		return url.pathname === '/' ? 'home' : 'detail';
	}

	private refreshState(page: RoutePageState, options?: { to?: SiteRoute; from?: SiteRoute }): void {
		const url = new URL(window.location.href);
		const current = this.readSiteRoute(url);
		this.state = {
			current,
			pathname: url.pathname,
			hash: url.hash,
			page,
			pageState: page,
			generation: this.state.generation + 1,
			...(options?.from ? { from: options.from } : this.state.from ? { from: this.state.from } : {}),
			...(options?.to ? { to: options.to } : this.state.to ? { to: this.state.to } : {}),
		};
	}

	private applyToDocument(): void {
		setDataset(document.documentElement, 'siteRoute', this.state.current);
		setDataset(document.documentElement, 'routeGeneration', this.state.generation);
		setDataset(document.documentElement, 'routeState', this.state.pageState);
	}

	private bindAstro(): void {
		if (this.initialized || typeof document === 'undefined') return;
		this.initialized = true;

		document.addEventListener('astro:before-preparation', this.handleBeforePreparation);
		document.addEventListener('astro:before-swap', this.handleBeforeSwap);
		document.addEventListener('astro:after-swap', this.handleAfterSwap);
		document.addEventListener('astro:page-load', this.handlePageLoad);
		window.addEventListener('popstate', this.handleUrlChange, { passive: true });
		window.addEventListener('hashchange', this.handleUrlChange, { passive: true });
		this.addCleanup(() => document.removeEventListener('astro:before-preparation', this.handleBeforePreparation));
		this.addCleanup(() => document.removeEventListener('astro:before-swap', this.handleBeforeSwap));
		this.addCleanup(() => document.removeEventListener('astro:after-swap', this.handleAfterSwap));
		this.addCleanup(() => document.removeEventListener('astro:page-load', this.handlePageLoad));
		this.addCleanup(() => window.removeEventListener('popstate', this.handleUrlChange));
		this.addCleanup(() => window.removeEventListener('hashchange', this.handleUrlChange));
	}

	private readonly handleBeforePreparation = (event: Event): void => {
		const transitionEvent = event as TransitionBeforePreparationEvent;
		const originalLoader = transitionEvent.loader;
		const previousRoute = this.readSiteRoute(transitionEvent.from);
		const nextRoute = this.readSiteRoute(transitionEvent.to);
		const id = this.createTransitionId(transitionEvent.signal);
		let aborted = false;
		const abortTransition = (): void => {
			if (aborted) return;
			aborted = true;
			this.emitAbort(id);
		};
		transitionEvent.signal.addEventListener('abort', abortTransition, { once: true });
		this.activeAbortCleanup = () => transitionEvent.signal.removeEventListener('abort', abortTransition);
		if (transitionEvent.signal.aborted) abortTransition();
		const exitWork = this.emitPreparation({
			id,
			to: transitionEvent.to,
			signal: transitionEvent.signal,
			previousRoute,
			nextRoute,
			fromPathname: transitionEvent.from.pathname,
			toPathname: transitionEvent.to.pathname,
		}).catch((error: unknown) => {
			abortTransition();
			throw error;
		});
		void exitWork.catch(() => undefined);

		transitionEvent.loader = async (): Promise<void> => {
			try {
				if (transitionEvent.signal.aborted) return;
				await Promise.all([originalLoader(), exitWork]);
				if (transitionEvent.signal.aborted || transitionEvent.defaultPrevented) abortTransition();
			} catch (error) {
				const cancelled = transitionEvent.signal.aborted;
				abortTransition();
				if (!cancelled) {
					// Astro falls back to a document navigation when preparation is prevented.
					transitionEvent.preventDefault();
					this.reportError('route.preparation', error);
				}
			}
		};
	};

	private readonly handleBeforeSwap = (event: Event): void => {
		const transitionEvent = event as TransitionBeforeSwapEvent;
		const id = this.readTransitionId(transitionEvent.signal);
		if (!this.isActiveTransition(id)) return;
		let swap = transitionEvent.swap;
		this.emitBeforeSwap({
			id,
			newDocument: transitionEvent.newDocument,
			wrapSwap(wrapper) {
				const previous = swap;
				swap = () => wrapper(previous);
			},
		});
		transitionEvent.swap = () => {
			try {
				swap();
				this.swappedTransitionId = id;
			} catch (error) {
				this.emitAbort(id);
				throw error;
			}
		};
	};

	private readonly handleAfterSwap = (): void => this.emitAfterSwap();

	private readonly handlePageLoad = (): void => this.emitLoad();

	private readonly handleUrlChange = (): void => this.syncLocation();

	private async emitPreparation(event: RoutePreparation): Promise<void> {
		if (!this.isActiveTransition(event.id)) return;
		this.refreshState('exiting', { from: event.previousRoute, to: event.nextRoute });
		this.applyToDocument();
		this.requestFrame('route:preparation');
		await Promise.all(Array.from(this.preparationHandlers, async (handler) => handler(event)));
	}

	private emitBeforeSwap(event: RouteSwap): void {
		// Owners release document resources here, before Astro attempts its swap.
		// A subsequent abort must rebuild those owners against the surviving DOM.
		this.cleanupTransitionId = event.id;
		this.refreshState('swapping');
		this.applyToDocument();
		for (const handler of Array.from(this.beforeSwapHandlers)) {
			try {
				handler(event);
			} catch (error) {
				this.reportError('route.beforeSwap', error);
			}
		}
		this.requestFrame('route:before-swap');
	}

	private emitAfterSwap(): void {
		const id = this.swappedTransitionId;
		this.swappedTransitionId = undefined;
		if (!this.isActiveTransition(id)) return;
		this.documentTransitionId = id;
		this.clearActiveTransition();
		this.refreshState('entering');
		delete this.state.from;
		delete this.state.to;
		this.applyToDocument();
		this.emitRouteHandlers('route.afterSwap', this.afterSwapHandlers, { id });
		this.requestFrame('route:after-swap');
	}

	private emitLoad(): void {
		// Astro's page-load event has no transition identity and also fires on the
		// initial window load. It cannot complete or cancel a newer preparation.
		if (this.activeTransitionId !== undefined) return;
		const id = this.documentTransitionId;
		this.refreshState('loaded');
		this.applyToDocument();
		try {
			this.emitRouteHandlers('route.load', this.loadHandlers, { id });
		} finally {
			if (this.activeTransitionId === undefined && this.documentTransitionId === id) this.setPageState('idle');
		}
	}

	private emitAbort(id: number): void {
		if (!this.isActiveTransition(id)) return;
		const needsRefresh = this.cleanupTransitionId === id;
		this.refreshState('idle');
		delete this.state.from;
		delete this.state.to;
		this.applyToDocument();
		this.clearActiveTransition();
		this.emitRouteHandlers('route.abort', this.abortHandlers, { id, needsRefresh });
		this.requestFrame('route:abort');
	}

	private emitRouteHandlers<TEvent extends RouteEvent>(name: string, handlers: ReadonlySet<(event: TEvent) => void>, event: TEvent): void {
		for (const handler of Array.from(handlers)) {
			try {
				handler(event);
			} catch (error) {
				this.reportError(name, error);
			}
		}
	}

	private createTransitionId(signal: AbortSignal): number {
		if (this.activeTransitionId !== undefined) this.emitAbort(this.activeTransitionId);
		this.nextTransitionId += 1;
		const id = this.nextTransitionId;
		this.activeTransitionId = id;
		this.transitionIds.set(signal, id);
		return id;
	}

	private readTransitionId(signal?: AbortSignal): number {
		return (signal && this.transitionIds.get(signal)) || this.activeTransitionId || 0;
	}

	private isActiveTransition(id: number | undefined): id is number {
		return id !== undefined && id !== 0 && id === this.activeTransitionId;
	}

	private clearActiveTransition(): void {
		this.activeAbortCleanup?.();
		this.activeAbortCleanup = undefined;
		this.cleanupTransitionId = undefined;
		this.activeTransitionId = undefined;
	}
}

const createRouteState = (): RouteState => {
	if (typeof window === 'undefined') {
		return {
			current: 'home',
			pathname: '/',
			hash: '',
			page: 'idle',
			pageState: 'idle',
			generation: 0,
		};
	}
	const url = new URL(window.location.href);
	return {
		current: url.pathname === '/' ? 'home' : 'detail',
		pathname: url.pathname,
		hash: url.hash,
		page: 'idle',
		pageState: 'idle',
		generation: 0,
	};
};

export const route = new RouteOwner();
export const getRouteState = (): RouteState => route.getState();
export const setRoutePageState = (page: RoutePageState): void => route.setPageState(page);
export const syncRouteLocation = (): void => route.syncLocation();
export const onRoutePreparation = (handler: PreparationHandler): (() => void) => route.onPreparation(handler);
export const onRouteBeforeSwap = (handler: SwapHandler): (() => void) => route.onBeforeSwap(handler);
export const onRouteAfterSwap = (handler: RouteHandler): (() => void) => route.onAfterSwap(handler);
export const onRouteLoad = (handler: RouteHandler): (() => void) => route.onLoad(handler);
export const onRouteAbort = (handler: AbortHandler): (() => void) => route.onAbort(handler);
