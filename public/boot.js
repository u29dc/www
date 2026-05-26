(() => {
	const root = document.documentElement;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const bootTimeoutMs = 1500;
	const panelIntroTimeoutMs = 1500;

	root.dataset.motion = reduceMotion ? 'reduced' : 'ready';
	root.dataset.lineRevealBoot = reduceMotion ? 'reduced' : 'pending';
	root.dataset.panelIntro = reduceMotion ? 'done' : 'pending';
	root.dataset.siteRoute = window.location.pathname === '/' ? 'home' : 'detail';

	if (reduceMotion) return;

	window.setTimeout(() => {
		if (root.dataset.motionBoot !== 'ready') {
			root.dataset.motion = 'reduced';
		}
	}, bootTimeoutMs);

	window.setTimeout(() => {
		if (root.dataset.lineRevealBoot === 'pending') {
			root.dataset.lineRevealBoot = 'failed';
		}
	}, bootTimeoutMs);

	window.setTimeout(() => {
		if (root.dataset.panelIntro !== 'done') {
			root.dataset.panelIntro = 'done';
		}
	}, panelIntroTimeoutMs);
})();
