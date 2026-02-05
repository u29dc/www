/**
 * Shared WebGL utilities for device capability detection and performance optimization.
 *
 * This module provides centralized device tier detection to help WebGL components
 * make informed decisions about rendering quality vs performance tradeoffs.
 */

export type DeviceTier = 'high' | 'medium' | 'low';

/**
 * Detects device performance tier based on hardware indicators.
 *
 * Uses navigator.deviceMemory and hardwareConcurrency as proxy metrics:
 * - low: <= 2GB RAM or <= 2 cores, or prefers-reduced-motion
 * - medium: <= 4GB RAM or <= 4 cores
 * - high: > 4GB RAM and > 4 cores
 *
 * Falls back to 'high' on server or when APIs unavailable.
 */
export function detectDeviceTier(): DeviceTier {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return 'high';
	}

	const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
	const cores = navigator.hardwareConcurrency ?? 4;
	const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

	if (prefersReducedMotion || memory <= 2 || cores <= 2) {
		return 'low';
	}
	if (memory <= 4 || cores <= 4) {
		return 'medium';
	}
	return 'high';
}

/**
 * Determines if grain overlay should be disabled to reduce GPU pressure.
 *
 * On low-tier devices, running two WebGL contexts (logo + grain) causes
 * noticeable GPU contention. Disabling the non-essential grain overlay
 * keeps the site performant while preserving the logo effect.
 */
export function shouldDisableGrainOverlay(): boolean {
	return detectDeviceTier() === 'low';
}

/**
 * Returns the appropriate device pixel ratio cap based on device tier.
 *
 * Higher DPR means more pixels to process. Capping DPR on lower-tier
 * devices significantly reduces GPU workload:
 * - low: 1x (native resolution)
 * - medium: 1.5x
 * - high: 2x (full retina on most displays)
 *
 * @param tier - Optional pre-computed device tier (uses detectDeviceTier if not provided)
 */
export function getDprCap(tier?: DeviceTier): number {
	const t = tier ?? detectDeviceTier();
	if (t === 'low') return 1;
	if (t === 'medium') return 1.5;
	return 2;
}
