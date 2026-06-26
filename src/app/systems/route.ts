import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { BaseModule, type Context } from '../core/module';
import type { RoutePageState, RouteState, SiteRoute } from '../core/state';

export type RoutePreparation = {
	to: URL;
	signal: AbortSignal;
	previousRoute: SiteRoute;
	nextRoute: SiteRoute;
};

export type RouteSwap = {
	newDocument: Document;
	wrapSwap: (wrapper: (swap: () => void) => void) => void;
};

type PreparationHandler = (event: RoutePreparation) => void | Promise<void>;
type SwapHandler = (event: RouteSwap) => void;
type RouteHandler = () => void;

class RouteOwner extends BaseModule {
	readonly name = 'route';

	private state: RouteState = createRouteState();
	private initialized = false;
	private readonly preparationHandlers = new Set<PreparationHandler>();
	private readonly beforeSwapHandlers = new Set<SwapHandler>();
	private readonly afterSwapHandlers = new Set<RouteHandler>();
	private readonly loadHandlers = new Set<RouteHandler>();
	private readonly abortHandlers = new Set<RouteHandler>();

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

	getState(): RouteState {
		return { ...this.state };
	}

	setPageState(page: RoutePageState): void {
		this.state.page = page;
		this.state.pageState = page;
		this.applyToDocument();
		this.requestFrame(`route:${page}`);
	}

	setHash(hash: string, options?: { replace?: boolean }): void {
		const normalized = normalizeHash(hash);
		const url = new URL(window.location.href);
		url.hash = normalized;
		if (url.href !== window.location.href) {
			if (options?.replace) {
				window.history.replaceState(window.history.state, '', url);
			} else {
				window.history.pushState(window.history.state, '', url);
			}
		}
		this.refreshState(this.state.page);
		this.applyToDocument();
		this.requestFrame('route:hash');
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

	onAbort(handler: RouteHandler): () => void {
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
		document.documentElement.dataset['siteRoute'] = this.state.current;
		document.documentElement.dataset['routeGeneration'] = String(this.state.generation);
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
		const exitWork = this.emitPreparation(transitionEvent.to, transitionEvent.signal);

		transitionEvent.loader = async (): Promise<void> => {
			try {
				await originalLoader();
				await exitWork;
			} catch (error) {
				this.emitAbort();
				throw error;
			}
		};
	};

	private readonly handleBeforeSwap = (event: Event): void => {
		const transitionEvent = event as TransitionBeforeSwapEvent;
		let swap = transitionEvent.swap;
		this.emitBeforeSwap({
			newDocument: transitionEvent.newDocument,
			wrapSwap(wrapper) {
				const previous = swap;
				swap = () => wrapper(previous);
			},
		});
		transitionEvent.swap = swap;
	};

	private readonly handleAfterSwap = (): void => this.emitAfterSwap();

	private readonly handlePageLoad = (): void => this.emitLoad();

	private readonly handleUrlChange = (): void => {
		this.refreshState('idle');
		this.applyToDocument();
		this.requestFrame('route:url');
	};

	private async emitPreparation(to: URL, signal: AbortSignal): Promise<void> {
		const previousRoute = this.state.current;
		const nextRoute = this.readSiteRoute(to);
		this.refreshState('exiting', { from: previousRoute, to: nextRoute });
		this.applyToDocument();
		this.requestFrame('route:preparation');
		await Promise.all(Array.from(this.preparationHandlers).map((handler) => handler({ to, signal, previousRoute, nextRoute })));
	}

	private emitBeforeSwap(event: RouteSwap): void {
		this.refreshState('swapping');
		this.applyToDocument();
		for (const handler of this.beforeSwapHandlers) handler(event);
		this.requestFrame('route:before-swap');
	}

	private emitAfterSwap(): void {
		this.refreshState('idle');
		delete this.state.from;
		delete this.state.to;
		this.applyToDocument();
		for (const handler of this.afterSwapHandlers) handler();
		this.requestFrame('route:after-swap');
	}

	private emitLoad(): void {
		this.refreshState('loaded');
		this.applyToDocument();
		for (const handler of this.loadHandlers) handler();
		this.setPageState('idle');
	}

	private emitAbort(): void {
		this.refreshState('idle');
		delete this.state.from;
		delete this.state.to;
		this.applyToDocument();
		for (const handler of this.abortHandlers) handler();
		this.requestFrame('route:abort');
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

const normalizeHash = (hash: string): string => {
	if (!hash) return '';
	return hash.startsWith('#') ? hash : `#${hash}`;
};

export const route = new RouteOwner();
export const getRouteState = (): RouteState => route.getState();
export const setRoutePageState = (page: RoutePageState): void => route.setPageState(page);
export const setRouteHash = (hash: string, options?: { replace?: boolean }): void => route.setHash(hash, options);
export const onRoutePreparation = (handler: PreparationHandler): (() => void) => route.onPreparation(handler);
export const onRouteBeforeSwap = (handler: SwapHandler): (() => void) => route.onBeforeSwap(handler);
export const onRouteAfterSwap = (handler: RouteHandler): (() => void) => route.onAfterSwap(handler);
export const onRouteLoad = (handler: RouteHandler): (() => void) => route.onLoad(handler);
export const onRouteAbort = (handler: RouteHandler): (() => void) => route.onAbort(handler);
