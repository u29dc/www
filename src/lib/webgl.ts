export type DeviceTier = 'high' | 'medium' | 'low';

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const safeMatchMedia = (query: string): boolean => (inBrowser() ? (window.matchMedia?.(query).matches ?? false) : false);

const getDeviceMemory = (): number => (inBrowser() ? ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) : 4);

const getHardwareConcurrency = (): number => (inBrowser() ? (navigator.hardwareConcurrency ?? 4) : 4);

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

export function getDprCap(options?: { tier?: DeviceTier; mobileAware?: boolean }): number {
	const tier = options?.tier ?? detectDeviceTier();
	const mobileAware = options?.mobileAware ?? false;
	const isMobile = mobileAware && safeMatchMedia('(max-width: 768px)');

	if (tier === 'low') return 1;
	if (tier === 'medium') return isMobile ? 1.25 : 1.5;
	return isMobile ? 1.5 : 2;
}

type DiagnosticValue = string | number | boolean | null;
type DiagnosticPayload = Record<string, DiagnosticValue>;

const STORAGE_DIAGNOSTICS_KEY = 'u29dc:webgl:diagnostics:astro';
const MAX_DIAGNOSTIC_EVENTS = 50;

const canUseStorage = (): boolean => {
	if (!inBrowser()) return false;
	try {
		return typeof window.localStorage !== 'undefined';
	} catch {
		return false;
	}
};

export const recordWebglDiagnostic = ({ feature, stage, result, data }: { feature: 'logo'; stage: string; result: string; data?: DiagnosticPayload }): void => {
	if (!canUseStorage()) return;

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
