import { BUILD } from '$lib/constants';

/**
 * Shared WebGL utilities for capability detection and reliability policy.
 *
 * WebGL effects in this project are progressive enhancement:
 * if runtime confidence is low, effects disable and content remains readable.
 */

export type DeviceTier = 'high' | 'medium' | 'low';
export type WebglOverlayMode = 'off' | 'probe' | 'on';

export interface WebglRuntimeConfig {
	mode: WebglOverlayMode;
	riskThreshold: number;
	warmupMs: number;
	warmupLongFrameMs: number;
	warmupMaxLongFrames: number;
	failureCooldownMs: number;
}

export interface WebglRiskSnapshot {
	deviceTier: DeviceTier;
	memory: number;
	cores: number;
	prefersReducedMotion: boolean;
	touchPoints: number;
	coarsePointer: boolean;
	dpr: number;
	viewportWidth: number;
}

export interface GrainOverlayPolicyDecision {
	allowed: boolean;
	mode: WebglOverlayMode;
	shouldProbe: boolean;
	riskScore: number;
	riskThreshold: number;
	reasons: string[];
	snapshot: WebglRiskSnapshot;
}

export interface GrainOverlayCooldownRecord {
	reason: string;
	timestamp: number;
	expiresAt: number;
	build: string;
}

type DiagnosticValue = string | number | boolean | null;
type DiagnosticPayload = Record<string, DiagnosticValue>;

const DEFAULT_MODE: WebglOverlayMode = 'probe';
const DEFAULT_RISK_THRESHOLD = 3;
const DEFAULT_WARMUP_MS = 1800;
const DEFAULT_LONG_FRAME_MS = 55;
const DEFAULT_WARMUP_MAX_LONG_FRAMES = 24;
const DEFAULT_FAIL_TTL_HOURS = 168;

const STORAGE_COOLDOWN_KEY = `u29dc:webgl:grain-cooldown:${BUILD.commitSha}`;
const STORAGE_DIAGNOSTICS_KEY = `u29dc:webgl:diagnostics:${BUILD.commitSha}`;
const MAX_DIAGNOSTIC_EVENTS = 50;

const getPublicEnv = (): Record<string, string | undefined> => {
	const maybeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
	if (maybeEnv) return maybeEnv;
	if (typeof process !== 'undefined' && process.env) {
		return process.env as Record<string, string | undefined>;
	}
	return {};
};

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const safeMatchMedia = (query: string): boolean => (inBrowser() ? (window.matchMedia?.(query).matches ?? false) : false);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const parseNumber = (value: string | undefined, fallback: number, min: number, max: number): number => {
	if (!value) return fallback;
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) return fallback;
	return clamp(parsed, min, max);
};

export const parseWebglOverlayMode = (value: string | null | undefined): WebglOverlayMode => {
	switch (value?.trim().toLowerCase()) {
		case 'off':
		case 'disabled':
		case 'false':
		case '0':
			return 'off';
		case 'on':
		case 'true':
		case '1':
		case 'enforce':
			return 'on';
		default:
			return DEFAULT_MODE;
	}
};

export const getWebglRuntimeConfig = (): WebglRuntimeConfig => {
	const env = getPublicEnv();

	return {
		mode: parseWebglOverlayMode(env['PUBLIC_WEBGL_OVERLAY_MODE']),
		riskThreshold: parseNumber(env['PUBLIC_WEBGL_OVERLAY_RISK_THRESHOLD'], DEFAULT_RISK_THRESHOLD, 0, 12),
		warmupMs: parseNumber(env['PUBLIC_WEBGL_OVERLAY_WARMUP_MS'], DEFAULT_WARMUP_MS, 300, 10000),
		warmupLongFrameMs: parseNumber(env['PUBLIC_WEBGL_OVERLAY_LONG_FRAME_MS'], DEFAULT_LONG_FRAME_MS, 20, 250),
		warmupMaxLongFrames: parseNumber(env['PUBLIC_WEBGL_OVERLAY_WARMUP_MAX_LONG_FRAMES'], DEFAULT_WARMUP_MAX_LONG_FRAMES, 0, 120),
		failureCooldownMs: parseNumber(env['PUBLIC_WEBGL_OVERLAY_FAIL_TTL_HOURS'], DEFAULT_FAIL_TTL_HOURS, 1, 24 * 30) * 60 * 60 * 1000,
	};
};

const getDeviceMemory = (): number => (inBrowser() ? ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) : 4);

const getHardwareConcurrency = (): number => (inBrowser() ? (navigator.hardwareConcurrency ?? 4) : 4);

const getTouchPoints = (): number => (inBrowser() ? (navigator.maxTouchPoints ?? 0) : 0);

/**
 * Detects device performance tier based on hardware indicators.
 *
 * Uses navigator.deviceMemory and hardwareConcurrency as proxy metrics:
 * - low: <= 2GB RAM or <= 2 cores, or prefers-reduced-motion
 * - medium: <= 4GB RAM or <= 4 cores
 * - high: > 4GB RAM and > 4 cores
 */
export function detectDeviceTier(): DeviceTier {
	const memory = getDeviceMemory();
	const cores = getHardwareConcurrency();
	const prefersReducedMotion = safeMatchMedia('(prefers-reduced-motion: reduce)');

	if (prefersReducedMotion || memory <= 2 || cores <= 2) {
		return 'low';
	}
	if (memory <= 4 || cores <= 4) {
		return 'medium';
	}
	return 'high';
}

/**
 * Returns true when the device is likely touch-first / coarse pointer.
 */
export function isLikelyTouchDevice(): boolean {
	if (!inBrowser()) return false;
	return getTouchPoints() > 0 || safeMatchMedia('(pointer: coarse)');
}

export const getWebglRiskSnapshot = (): WebglRiskSnapshot => ({
	deviceTier: detectDeviceTier(),
	memory: getDeviceMemory(),
	cores: getHardwareConcurrency(),
	prefersReducedMotion: safeMatchMedia('(prefers-reduced-motion: reduce)'),
	touchPoints: getTouchPoints(),
	coarsePointer: safeMatchMedia('(pointer: coarse)'),
	dpr: inBrowser() ? window.devicePixelRatio || 1 : 1,
	viewportWidth: inBrowser() ? window.innerWidth : 1024,
});

const scoreOverlayRisk = (snapshot: WebglRiskSnapshot): number => {
	let score = 0;

	if (snapshot.prefersReducedMotion) score += 5;
	if (snapshot.deviceTier === 'low') score += 4;
	if (snapshot.deviceTier === 'medium') score += 1;
	if (snapshot.touchPoints > 0) score += 2;
	if (snapshot.coarsePointer) score += 1;
	if (snapshot.dpr >= 2.5) score += 1;
	if (snapshot.memory <= 3) score += 1;
	if (snapshot.cores <= 4) score += 1;

	return score;
};

export const evaluateGrainOverlayPolicy = (): GrainOverlayPolicyDecision => {
	const config = getWebglRuntimeConfig();
	const snapshot = getWebglRiskSnapshot();
	const riskScore = scoreOverlayRisk(snapshot);
	const reasons: string[] = [];

	if (snapshot.prefersReducedMotion) reasons.push('prefers_reduced_motion');
	if (snapshot.deviceTier === 'low') reasons.push('tier_low');
	if (snapshot.deviceTier === 'medium') reasons.push('tier_medium');
	if (snapshot.touchPoints > 0) reasons.push('touch_points');
	if (snapshot.coarsePointer) reasons.push('coarse_pointer');
	if (snapshot.dpr >= 2.5) reasons.push('high_dpr');
	if (riskScore >= config.riskThreshold) reasons.push('risk_threshold_exceeded');

	if (config.mode === 'off') {
		reasons.push('mode_off');
		return {
			allowed: false,
			mode: config.mode,
			shouldProbe: false,
			riskScore,
			riskThreshold: config.riskThreshold,
			reasons,
			snapshot,
		};
	}

	if (snapshot.prefersReducedMotion) {
		return {
			allowed: false,
			mode: config.mode,
			shouldProbe: false,
			riskScore,
			riskThreshold: config.riskThreshold,
			reasons,
			snapshot,
		};
	}

	if (config.mode === 'on') {
		reasons.push('mode_on');
		return {
			allowed: true,
			mode: config.mode,
			shouldProbe: true,
			riskScore,
			riskThreshold: config.riskThreshold,
			reasons,
			snapshot,
		};
	}

	return {
		allowed: riskScore < config.riskThreshold,
		mode: config.mode,
		shouldProbe: true,
		riskScore,
		riskThreshold: config.riskThreshold,
		reasons,
		snapshot,
	};
};

/**
 * Compatibility helper for existing call sites.
 */
export function shouldDisableGrainOverlay(): boolean {
	return !evaluateGrainOverlayPolicy().allowed;
}

/**
 * Returns the appropriate device pixel ratio cap based on device tier.
 *
 * @param options.tier optional pre-computed tier
 * @param options.mobileAware when true, use lower caps on narrow screens
 */
export function getDprCap(options?: { tier?: DeviceTier; mobileAware?: boolean }): number {
	const tier = options?.tier ?? detectDeviceTier();
	const mobileAware = options?.mobileAware ?? false;
	const isMobile = mobileAware && safeMatchMedia('(max-width: 768px)');

	if (tier === 'low') return 1;
	if (tier === 'medium') return isMobile ? 1.25 : 1.5;
	return isMobile ? 1.5 : 2;
}

const canUseStorage = (): boolean => {
	if (!inBrowser()) return false;
	try {
		return typeof window.localStorage !== 'undefined';
	} catch {
		return false;
	}
};

export const readGrainOverlayCooldown = (): GrainOverlayCooldownRecord | null => {
	if (!canUseStorage()) return null;

	try {
		const raw = window.localStorage.getItem(STORAGE_COOLDOWN_KEY);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as Partial<GrainOverlayCooldownRecord>;
		if (typeof parsed.reason !== 'string' || typeof parsed.timestamp !== 'number' || typeof parsed.expiresAt !== 'number') {
			window.localStorage.removeItem(STORAGE_COOLDOWN_KEY);
			return null;
		}

		if (Date.now() >= parsed.expiresAt) {
			window.localStorage.removeItem(STORAGE_COOLDOWN_KEY);
			return null;
		}

		return {
			reason: parsed.reason,
			timestamp: parsed.timestamp,
			expiresAt: parsed.expiresAt,
			build: typeof parsed.build === 'string' ? parsed.build : BUILD.commitSha,
		};
	} catch {
		return null;
	}
};

export const writeGrainOverlayCooldown = (reason: string): GrainOverlayCooldownRecord | null => {
	if (!canUseStorage()) return null;

	const config = getWebglRuntimeConfig();
	const now = Date.now();
	const record: GrainOverlayCooldownRecord = {
		reason,
		timestamp: now,
		expiresAt: now + config.failureCooldownMs,
		build: BUILD.commitSha,
	};

	try {
		window.localStorage.setItem(STORAGE_COOLDOWN_KEY, JSON.stringify(record));
		return record;
	} catch {
		return null;
	}
};

export const clearGrainOverlayCooldown = (): void => {
	if (!canUseStorage()) return;
	try {
		window.localStorage.removeItem(STORAGE_COOLDOWN_KEY);
	} catch {
		// ignore storage errors
	}
};

export const recordWebglDiagnostic = ({ feature, stage, result, data }: { feature: 'grain-overlay' | 'atomic-logo'; stage: string; result: string; data?: DiagnosticPayload }): void => {
	if (!canUseStorage()) return;

	const event = {
		feature,
		stage,
		result,
		data: data ?? {},
		timestamp: Date.now(),
		build: BUILD.commitSha,
	};

	try {
		const raw = window.localStorage.getItem(STORAGE_DIAGNOSTICS_KEY);
		const parsed = raw ? (JSON.parse(raw) as unknown) : [];
		const list = Array.isArray(parsed) ? parsed : [];
		list.push(event);
		if (list.length > MAX_DIAGNOSTIC_EVENTS) {
			list.splice(0, list.length - MAX_DIAGNOSTIC_EVENTS);
		}
		window.localStorage.setItem(STORAGE_DIAGNOSTICS_KEY, JSON.stringify(list));
	} catch {
		// ignore storage errors
	}
};
