export const MOTION = {
	pageExitMs: 500,
	revealFallbackMs: 1_500,
	revealRootMargin: '0px 0px -8% 0px',
	revealThreshold: 0.01,
	revealMaxIndex: 7,
	siteRouteMotionBufferMs: 80,
	lineGroupRevealDelayMs: 0,
	panelIntroMs: 800,
	panelIntroDelayMs: 80,
	panelIntroBufferMs: 80,
	line: {
		rootMargin: '0px 0px -8% 0px',
		threshold: 0.01,
		fontWaitMs: 180,
		frameWaitMs: 120,
		maxTotalLines: 220,
		maxTargets: 72,
		durationMs: 560,
		staggerMs: 26,
		maxTotalMs: 1_150,
		handoffMs: 90,
		staggeredLines: 24,
		completionBufferMs: 80,
		groupCompleteBufferMs: 8,
		groupFollowOverlapMs: 140,
		fullMaxTokens: 520,
		liteMaxTokens: 120,
		fullMaxLinesPerTarget: 32,
		liteMaxLinesPerTarget: 6,
		liteMeasureBudgetMs: 10,
		widthChangeTolerancePx: 1,
		lineTopTolerancePx: 3,
		minRectSizePx: 0.2,
		overlayEdgePadPx: 1,
	},
	preview: {
		hideDelayMs: 180,
		pauseDelayMs: 180,
		edgeGapPx: 12,
		videoSlotLimit: 4,
		defaultRatio: 1.6,
		defaultWidthPx: 280,
		defaultHeightPx: 180,
		artifactOffsetX: 22,
		artifactOffsetY: 18,
		linkOffsetX: 14,
		linkOffsetY: 12,
		artifactStiffness: 0.18,
		linkStiffness: 0.24,
		settleDeltaPx: 0.25,
	},
	media: {
		rootMargin: '240px 0px',
		threshold: 0.1,
	},
} as const;

export const readDurationToken = (propertyName: string, fallbackMilliseconds: number): number => {
	const rawValue = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
	const value = Number.parseFloat(rawValue);

	if (!Number.isFinite(value)) return fallbackMilliseconds;
	if (rawValue.endsWith('ms')) return value;
	if (rawValue.endsWith('s')) return value * 1_000;

	return value;
};

export const readNumberToken = (propertyName: string, fallback: number): number => {
	const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim());
	return Number.isFinite(value) ? value : fallback;
};
