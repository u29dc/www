import { getContext, setContext } from 'svelte';
import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

export type EasingFunction = (t: number) => number;

export type StageSpec = {
	id: string;
	duration?: number;
	delay?: number;
	y?: number;
	blur?: number;
	easing?: EasingFunction;
};

export type TimelineSpec = {
	id: string;
	stages: StageSpec[];
	defaults?: Partial<Omit<StageTiming, 'delay'>>;
};

export type StageTiming = {
	delay: number;
	duration: number;
	y: number;
	blur: number;
	easing: EasingFunction;
};

export type Timeline = {
	id: string;
	stages: Map<string, StageTiming>;
	defaults: StageTiming;
};

const TIMELINE_KEY = Symbol('timeline');

const DEFAULT_STAGE: StageTiming = {
	delay: 0,
	duration: 600,
	y: 8,
	blur: 6,
	easing: cubicOut,
};

const clampZero = (value: number) => Math.max(0, value);

export const createTimeline = (spec: TimelineSpec): Timeline => {
	const defaults: StageTiming = {
		...DEFAULT_STAGE,
		...spec.defaults,
		delay: 0,
	};
	const stages = new Map<string, StageTiming>();

	let cursor = 0;

	for (const stage of spec.stages) {
		const duration = clampZero(stage.duration ?? defaults.duration);
		const delay = stage.delay ?? 0;
		const start = clampZero(cursor + delay);

		const timing: StageTiming = {
			delay: start,
			duration,
			y: stage.y ?? defaults.y,
			blur: stage.blur ?? defaults.blur,
			easing: stage.easing ?? defaults.easing,
		};

		stages.set(stage.id, timing);
		cursor = Math.max(cursor, start + duration);
	}

	return {
		id: spec.id,
		stages,
		defaults,
	};
};

export const setTimeline = (timeline: Timeline): void => {
	setContext(TIMELINE_KEY, timeline);
};

export const getTimeline = (): Timeline | null => {
	return getContext<Timeline>(TIMELINE_KEY);
};

export const resolveStage = (timeline: Timeline | null, stageId: string): StageTiming => {
	if (!timeline) return DEFAULT_STAGE;
	return timeline.stages.get(stageId) ?? timeline.defaults;
};

export type FadeBlurParams = {
	delay?: number;
	duration?: number;
	y?: number;
	blur?: number;
	easing?: EasingFunction;
};

export const fadeBlur = (node: Element, params: FadeBlurParams = {}) => {
	const reduceMotion = prefersReducedMotion.current;

	const delay = reduceMotion ? 0 : clampZero(params.delay ?? 0);
	const duration = reduceMotion ? 0 : clampZero(params.duration ?? DEFAULT_STAGE.duration);
	const y = reduceMotion ? 0 : (params.y ?? DEFAULT_STAGE.y);
	const blur = reduceMotion ? 0 : (params.blur ?? DEFAULT_STAGE.blur);
	const easing = params.easing ?? DEFAULT_STAGE.easing;

	const style = getComputedStyle(node);
	const baseTransform = style.transform === 'none' ? '' : style.transform;
	const transformPrefix = baseTransform ? `${baseTransform} ` : '';
	const shouldTransform = y !== 0;

	return {
		delay,
		duration,
		easing,
		css: (t: number, u: number) => {
			const rules = [`opacity: ${t}`, `filter: blur(${u * blur}px)`];
			if (shouldTransform) {
				rules.push(`transform: ${transformPrefix}translate3d(0, ${u * y}px, 0)`);
			}
			return rules.join('; ');
		},
	};
};

export const TIMELINE_INDEX = createTimeline({
	id: 'index',
	defaults: {
		duration: 650,
		y: 8,
		blur: 6,
		easing: cubicOut,
	},
	stages: [
		{ id: 'header', duration: 260, delay: 0, y: 6, blur: 4 },
		{ id: 'statement', duration: 800, delay: -120 },
		{ id: 'scroll', duration: 700, delay: -280, y: 0, blur: 4 },
		{ id: 'artifacts', duration: 700, delay: -220 },
		{ id: 'axioms', duration: 700, delay: -240 },
		{ id: 'protocols', duration: 700, delay: -240 },
		{ id: 'footer', duration: 600, delay: -320 },
	],
});

export const TIMELINE_ARTICLE = createTimeline({
	id: 'article',
	defaults: {
		duration: 600,
		y: 8,
		blur: 6,
		easing: cubicOut,
	},
	stages: [
		{ id: 'header', duration: 240, delay: 0, y: 6, blur: 4 },
		{ id: 'scroll', duration: 650, delay: -200, y: 0, blur: 4 },
		{ id: 'article', duration: 700, delay: -200 },
		{ id: 'footer', duration: 600, delay: -260 },
	],
});
