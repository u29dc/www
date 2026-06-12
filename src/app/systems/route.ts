import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { AppOwner, type Context } from '../core/owner';
import type { RouteState, SiteRoute } from '../core/state';

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

class RouteOwner extends AppOwner {
	readonly name = 'route';
	override readonly order = 20;

	private state: RouteState = {
		current: typeof window === 'undefined' ? 'home' : this.readSiteRoute(),
		page: 'idle',
	};
	private initialized = false;
	private readonly preparationHandlers = new Set<PreparationHandler>();
	private readonly beforeSwapHandlers = new Set<SwapHandler>();
	private readonly afterSwapHandlers = new Set<RouteHandler>();
	private readonly loadHandlers = new Set<RouteHandler>();
	private readonly abortHandlers = new Set<RouteHandler>();

	override preinit(context: Context): void {
		super.preinit(context);
		this.state.current = this.readSiteRoute();
		this.state.page = 'idle';
		this.bindAstro();
		this.applyToDocument();
	}

	init(): void {
		this.state.current = this.readSiteRoute();
		this.applyToDocument();
	}

	getState(): RouteState {
		return { ...this.state };
	}

	setPageState(page: RouteState['page']): void {
		this.state.page = page;
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

	private applyToDocument(): void {
		document.documentElement.dataset['siteRoute'] = this.state.current;
	}

	private bindAstro(): void {
		if (this.initialized || typeof document === 'undefined') return;
		this.initialized = true;

		document.addEventListener('astro:before-preparation', (event) => {
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
		});

		document.addEventListener('astro:before-swap', (event) => {
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
		});

		document.addEventListener('astro:after-swap', () => this.emitAfterSwap());
		document.addEventListener('astro:page-load', () => this.emitLoad());
	}

	private async emitPreparation(to: URL, signal: AbortSignal): Promise<void> {
		const previousRoute = this.state.current;
		const nextRoute = this.readSiteRoute(to);
		this.state.page = 'exiting';
		this.state.to = nextRoute;
		await Promise.all(Array.from(this.preparationHandlers).map((handler) => handler({ to, signal, previousRoute, nextRoute })));
	}

	private emitBeforeSwap(event: RouteSwap): void {
		this.state.page = 'swapping';
		for (const handler of this.beforeSwapHandlers) handler(event);
	}

	private emitAfterSwap(): void {
		this.state.current = this.readSiteRoute();
		this.state.page = 'idle';
		delete this.state.to;
		this.applyToDocument();
		for (const handler of this.afterSwapHandlers) handler();
	}

	private emitLoad(): void {
		this.state.current = this.readSiteRoute();
		this.state.page = 'loaded';
		this.applyToDocument();
		for (const handler of this.loadHandlers) handler();
		this.state.page = 'idle';
	}

	private emitAbort(): void {
		this.state.current = this.readSiteRoute();
		this.state.page = 'idle';
		delete this.state.to;
		this.applyToDocument();
		for (const handler of this.abortHandlers) handler();
	}
}

export const route = new RouteOwner();
export const getRouteState = (): RouteState => route.getState();
export const setRoutePageState = (page: RouteState['page']): void => route.setPageState(page);
export const onRoutePreparation = (handler: PreparationHandler): (() => void) => route.onPreparation(handler);
export const onRouteBeforeSwap = (handler: SwapHandler): (() => void) => route.onBeforeSwap(handler);
export const onRouteAfterSwap = (handler: RouteHandler): (() => void) => route.onAfterSwap(handler);
export const onRouteLoad = (handler: RouteHandler): (() => void) => route.onLoad(handler);
export const onRouteAbort = (handler: RouteHandler): (() => void) => route.onAbort(handler);
