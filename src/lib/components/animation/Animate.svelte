<script lang="ts">
import type { Snippet } from 'svelte';
import { fadeBlur, getTimeline, resolveEasingCss, resolveStage } from '$lib/animation';

type Props = {
	stage: string;
	index?: number;
	stagger?: number;
	delay?: number;
	duration?: number;
	y?: number;
	blur?: number;
	className?: string;
	tag?: string;
	children: Snippet;
};

let { stage, index = 0, stagger = 0, delay = 0, duration, y, blur, className = '', tag = 'div', children }: Props = $props();

const timeline = getTimeline();
const stageTiming = $derived(resolveStage(timeline, stage));

const computedDelay = $derived(Math.max(0, stageTiming.delay + delay + index * stagger));
const computedDuration = $derived(duration ?? stageTiming.duration);
const computedY = $derived(y ?? stageTiming.y);
const computedBlur = $derived(blur ?? stageTiming.blur);
const easingCss = $derived(resolveEasingCss(stageTiming.easing));

const classes = $derived(className ? `transform-gpu ${className}` : 'transform-gpu');
const style = $derived.by(() => {
	return [
		'will-change: transform, opacity, filter',
		'backface-visibility: hidden',
		`--animate-delay: ${computedDelay}ms`,
		`--animate-duration: ${computedDuration}ms`,
		`--animate-y: ${computedY}px`,
		`--animate-blur: ${computedBlur}px`,
		`--animate-ease: ${easingCss}`,
	].join('; ');
});
</script>

<svelte:element
	this={tag}
	class={classes}
	{style}
	data-animate
	in:fadeBlur={{
		delay: computedDelay,
		duration: computedDuration,
		y: computedY,
		blur: computedBlur,
		easing: stageTiming.easing,
	}}
>
	{@render children()}
</svelte:element>
