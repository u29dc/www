import { createTask } from '../runtime/task';

export type SiteRoute = 'home' | 'detail';

export type RouteState = {
	current: SiteRoute;
	page: 'idle' | 'exiting' | 'swapping' | 'loaded';
	to?: SiteRoute;
};

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

const preparationHandlers = new Set<PreparationHandler>();
const beforeSwapHandlers = new Set<SwapHandler>();
const afterSwapHandlers = new Set<RouteHandler>();
const loadHandlers = new Set<RouteHandler>();
const abortHandlers = new Set<RouteHandler>();

const readSiteRoute = (url: URL | Location = window.location): SiteRoute => (url.pathname === '/' ? 'home' : 'detail');

const state: RouteState = {
	current: typeof window === 'undefined' ? 'home' : readSiteRoute(),
	page: 'idle',
};

const applyRouteToDocument = (): void => {
	document.documentElement.dataset['siteRoute'] = state.current;
};

export const route = createTask({
	name: 'route',
	order: 20,
	state,
	preinit() {
		state.current = readSiteRoute();
		state.page = 'idle';
		applyRouteToDocument();
	},
	init() {
		state.current = readSiteRoute();
		applyRouteToDocument();
	},
});

export const getRouteState = (): RouteState => ({ ...state });

export const setRoutePageState = (page: RouteState['page']): void => {
	state.page = page;
};

export const onRoutePreparation = (handler: PreparationHandler): (() => void) => {
	preparationHandlers.add(handler);
	return () => {
		preparationHandlers.delete(handler);
	};
};

export const onRouteBeforeSwap = (handler: SwapHandler): (() => void) => {
	beforeSwapHandlers.add(handler);
	return () => {
		beforeSwapHandlers.delete(handler);
	};
};

export const onRouteAfterSwap = (handler: RouteHandler): (() => void) => {
	afterSwapHandlers.add(handler);
	return () => {
		afterSwapHandlers.delete(handler);
	};
};

export const onRouteLoad = (handler: RouteHandler): (() => void) => {
	loadHandlers.add(handler);
	return () => {
		loadHandlers.delete(handler);
	};
};

export const onRouteAbort = (handler: RouteHandler): (() => void) => {
	abortHandlers.add(handler);
	return () => {
		abortHandlers.delete(handler);
	};
};

export const emitRoutePreparation = async (to: URL, signal: AbortSignal): Promise<void> => {
	const previousRoute = state.current;
	const nextRoute = readSiteRoute(to);
	state.page = 'exiting';
	state.to = nextRoute;
	await Promise.all(Array.from(preparationHandlers).map((handler) => handler({ to, signal, previousRoute, nextRoute })));
};

export const emitRouteBeforeSwap = (event: RouteSwap): void => {
	state.page = 'swapping';
	for (const handler of beforeSwapHandlers) handler(event);
};

export const emitRouteAfterSwap = (): void => {
	state.current = readSiteRoute();
	state.page = 'idle';
	delete state.to;
	applyRouteToDocument();
	for (const handler of afterSwapHandlers) handler();
};

export const emitRouteLoad = (): void => {
	state.current = readSiteRoute();
	state.page = 'loaded';
	applyRouteToDocument();
	for (const handler of loadHandlers) handler();
	state.page = 'idle';
};

export const emitRouteAbort = (): void => {
	state.current = readSiteRoute();
	state.page = 'idle';
	delete state.to;
	applyRouteToDocument();
	for (const handler of abortHandlers) handler();
};
