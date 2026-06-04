import { getDeviceProfile, getDprCap as getProfileDprCap, initDeviceProfile, type PerformanceTier } from './device';

export type DeviceTier = PerformanceTier;
export type WebglDiagnosticsMode = 'off' | 'critical' | 'full';

type DiagnosticValue = string | number | boolean | null;
type DiagnosticPayload = Record<string, DiagnosticValue>;

const STORAGE_DIAGNOSTICS_KEY = 'u29dc:webgl:diagnostics:astro';
const STORAGE_DEBUG_KEY = 'u29dc:webgl:debug';
const MAX_DIAGNOSTIC_EVENTS = 50;

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const canUseStorage = (): boolean => {
	if (!inBrowser()) return false;
	try {
		return typeof window.localStorage !== 'undefined';
	} catch {
		return false;
	}
};

const readStorageValue = (key: string): string | undefined => {
	if (!canUseStorage()) return undefined;
	try {
		return window.localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
};

const isDevelopment = (): boolean => import.meta.env.DEV;

export function getWebglDiagnosticsMode(): WebglDiagnosticsMode {
	if (readStorageValue(STORAGE_DEBUG_KEY) === '1') return 'full';
	if (isDevelopment()) return 'full';
	return 'critical';
}

export function shouldRunFullWebglDiagnostics(mode: WebglDiagnosticsMode = getWebglDiagnosticsMode()): boolean {
	return mode === 'full';
}

export function shouldRecordWebglDiagnostics(mode: WebglDiagnosticsMode = getWebglDiagnosticsMode()): boolean {
	return mode !== 'off';
}

export function detectDeviceTier(): DeviceTier {
	initDeviceProfile();
	return getDeviceProfile().tier;
}

export function getDprCap(options?: { tier?: DeviceTier; mobileAware?: boolean }): number {
	if (options?.tier) {
		if (options.tier === 'low') return 1;
		if (options.tier === 'medium') return options.mobileAware ? 1.25 : 1.5;
		return options.mobileAware ? 1.5 : 2;
	}

	initDeviceProfile();
	return getProfileDprCap(getDeviceProfile(), options?.mobileAware === undefined ? undefined : { mobileAware: options.mobileAware });
}

export const recordWebglDiagnostic = ({ feature, stage, result, data, mode }: { feature: 'logo'; stage: string; result: string; data?: DiagnosticPayload; mode?: WebglDiagnosticsMode }): void => {
	if (!canUseStorage() || !shouldRecordWebglDiagnostics(mode)) return;

	const event = {
		feature,
		stage,
		result,
		data: data ?? {},
		timestamp: Date.now(),
		build: 'astro',
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
