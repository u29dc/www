(() => {
	const root = document.documentElement;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
	const finePointer = window.matchMedia('(hover: hover), (pointer: fine)').matches;
	const bootTimeoutMs = 1500;
	const panelIntroTimeoutMs = 1500;

	root.dataset.motion = reduceMotion ? 'reduced' : 'ready';
	root.dataset.motionQuality = reduceMotion ? 'reduced' : 'full';
	root.dataset.performanceTier = 'medium';
	root.dataset.inputProfile = coarsePointer && finePointer ? 'mixed' : coarsePointer ? 'coarse' : finePointer ? 'fine' : 'unknown';
	root.dataset.networkProfile = 'unknown';
	root.dataset.displayProfile = window.innerWidth < 640 ? 'small' : window.innerWidth >= 1440 ? 'large' : 'standard';
	root.dataset.deviceProfileSource = 'boot';
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
