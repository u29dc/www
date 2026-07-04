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

export const isElement = (value: EventTarget | null): value is Element => value instanceof Element;

export const pathClosest = <TElement extends Element>(path: readonly EventTarget[], selector: string): TElement | undefined => {
	for (const item of path) {
		if (!(item instanceof Element)) continue;
		const match = item.closest<TElement>(selector);
		if (match) return match;
	}
	return undefined;
};

export const setDataset = (element: HTMLElement, key: string, value: string | number | boolean): boolean => {
	const next = String(value);
	if (!next) return removeDataset(element, key);
	if (element.dataset[key] === next) return false;
	element.dataset[key] = next;
	return true;
};

export const removeDataset = (element: HTMLElement, key: string): boolean => {
	if (element.dataset[key] === undefined) return false;
	delete element.dataset[key];
	return true;
};

export const setStyleProperty = (element: HTMLElement, property: string, value: string | number): boolean => {
	const next = String(value);
	if (!next || next === 'NaN' || next === 'Infinity' || next === '-Infinity') {
		return removeStyleProperty(element, property);
	}
	if (element.style.getPropertyValue(property) === next) return false;
	element.style.setProperty(property, next);
	return true;
};

export const removeStyleProperty = (element: HTMLElement, property: string): boolean => {
	if (!element.style.getPropertyValue(property)) return false;
	element.style.removeProperty(property);
	return true;
};

export const toggleClass = (element: Element, className: string, enabled: boolean): boolean => {
	if (!isClassToken(className)) return false;
	const hasClass = element.classList.contains(className);
	if (hasClass === enabled) return false;
	element.classList.toggle(className, enabled);
	return true;
};

export const isClassToken = (value: string): boolean => {
	const token = value.trim();
	return token.length > 0 && !/\s/.test(token);
};

export const readClassToken = (value: string | undefined, fallback: string): string => (value && isClassToken(value) ? value.trim() : fallback);

export const focusElement = (element: HTMLElement): void => {
	const previousTabIndex = element.getAttribute('tabindex');
	if (previousTabIndex === null) element.setAttribute('tabindex', '-1');
	element.focus({ preventScroll: true });
	if (previousTabIndex === null) {
		element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
	}
};
