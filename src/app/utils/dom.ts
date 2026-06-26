export const composedPath = (event: Event): EventTarget[] => {
	const path = event.composedPath?.();
	if (path && path.length > 0) return path;
	const fallback: EventTarget[] = [];
	let node = event.target;
	while (node instanceof Node) {
		fallback.push(node);
		node = node.parentNode;
	}
	fallback.push(window);
	return fallback;
};

export const pathClosest = <TElement extends Element>(path: readonly EventTarget[], selector: string): TElement | undefined => {
	for (const item of path) {
		if (!(item instanceof Element)) continue;
		const match = item.closest<TElement>(selector);
		if (match) return match;
	}
	return undefined;
};

export const focusElement = (element: HTMLElement): void => {
	const previousTabIndex = element.getAttribute('tabindex');
	if (previousTabIndex === null) element.setAttribute('tabindex', '-1');
	element.focus({ preventScroll: true });
	if (previousTabIndex === null) {
		element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
	}
};
