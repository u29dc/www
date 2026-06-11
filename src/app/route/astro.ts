import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { emitRouteAbort, emitRouteAfterSwap, emitRouteBeforeSwap, emitRouteLoad, emitRoutePreparation } from './route';

let initialized = false;

export const initAstroRouteAdapter = (): void => {
	if (initialized || typeof document === 'undefined') return;
	initialized = true;

	document.addEventListener('astro:before-preparation', (event) => {
		const transitionEvent = event as TransitionBeforePreparationEvent;
		const originalLoader = transitionEvent.loader;
		const exitWork = emitRoutePreparation(transitionEvent.to, transitionEvent.signal);

		transitionEvent.loader = async (): Promise<void> => {
			try {
				await originalLoader();
				await exitWork;
			} catch (error) {
				emitRouteAbort();
				throw error;
			}
		};
	});

	document.addEventListener('astro:before-swap', (event) => {
		const transitionEvent = event as TransitionBeforeSwapEvent;
		let swap = transitionEvent.swap;
		emitRouteBeforeSwap({
			newDocument: transitionEvent.newDocument,
			wrapSwap(wrapper) {
				const previous = swap;
				swap = () => wrapper(previous);
			},
		});
		transitionEvent.swap = swap;
	});

	document.addEventListener('astro:after-swap', emitRouteAfterSwap);
	document.addEventListener('astro:page-load', emitRouteLoad);
};
