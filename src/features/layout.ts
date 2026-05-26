import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

const CONTENT_PANEL_STYLE_ID = 'content-panel-layout-rule';
const CONTENT_PANEL_CSS = `
@media (width >= 64rem) {
	[data-content-panel]::before {
		--panel-track: calc((100% - (var(--space-page) * 2) - (var(--grid-gap) * 9)) / 10);
		width: calc((var(--space-page) * 2) + (var(--panel-track) * 5) + (var(--grid-gap) * 4));
	}
}
`;

const ensureContentPanelRule = (doc: Document = document): void => {
	let style = doc.getElementById(CONTENT_PANEL_STYLE_ID);

	if (!(style instanceof HTMLStyleElement)) {
		style = doc.createElement('style');
		style.id = CONTENT_PANEL_STYLE_ID;
		style.dataset['runtimeLayout'] = 'content-panel';
		doc.head.append(style);
	}

	if (style.textContent !== CONTENT_PANEL_CSS) {
		style.textContent = CONTENT_PANEL_CSS;
	}
};

document.addEventListener('astro:before-swap', (event) => {
	ensureContentPanelRule((event as TransitionBeforeSwapEvent).newDocument);
});

document.addEventListener('astro:after-swap', () => ensureContentPanelRule());
document.addEventListener('astro:page-load', () => ensureContentPanelRule());

ensureContentPanelRule();
