/**
 * Timeline Configurations
 *
 * Static timeline configurations for all pages with hoisted predicates for
 * stable references.
 *
 * @module lib/animation/configs
 */

import type { TimelineConfig } from '@/lib/animation/timeline';

/** Home page timeline configuration */
export const homeTimeline: TimelineConfig = {
	id: 'home',
	enterStages: [
		{
			id: 'home-title',
			duration: 2000,
			delay: 0,
		},
		{
			id: 'home-description',
			duration: 500,
			delay: 0,
		},
		{
			id: 'home-header',
			duration: 500,
			delay: -250,
		},
		{
			id: 'home-feed',
			duration: 1000,
			delay: -500,
		},
	],
	exitStages: [
		{
			id: 'home-feed',
			duration: 500,
			delay: 0,
		},
		{
			id: 'home-description',
			duration: 250,
			delay: -250,
		},
		{
			id: 'home-header',
			duration: 250,
			delay: -250,
		},
		{
			id: 'home-title',
			duration: 500,
			delay: 0,
		},
	],
	enterSpeedMultiplier: 1,
	exitSpeedMultiplier: 2.0,
};

/** Content page timeline configuration */
export const contentTimeline: TimelineConfig = {
	id: 'content',
	enterStages: [
		{
			id: 'content-header',
			duration: 500,
			delay: 0,
		},
		{
			id: 'content-body',
			duration: 500,
			delay: -200, // Starts 200ms before header finishes (overlap)
		},
	],
	exitStages: [
		{
			id: 'content-body',
			duration: 500,
			delay: 0,
		},
		{
			id: 'content-header',
			duration: 500,
			delay: -200, // Overlap with body exit
		},
	],
	enterSpeedMultiplier: 1,
	exitSpeedMultiplier: 2.0,
};
