'use client';

/**
 * Theme Management System
 *
 * ## SUMMARY
 * Cookie-based theme system with SSR support and system preference sync.
 *
 * ## RESPONSIBILITIES
 * - Persist theme preferences via cookies
 * - Resolve system preferences and prevent FOUC
 *
 * @module lib/theme
 */

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
}

export interface ThemeProviderProps {
	children: React.ReactNode;
	initialTheme?: Theme;
	initialResolved?: ResolvedTheme;
}

const THEME_COOKIE_NAME = 'u29dc-theme';
const RESOLVED_THEME_COOKIE_NAME = 'u29dc-theme-resolved';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie<T extends string>(
	name: string,
	validator?: (v: string) => v is T,
): T | undefined {
	if (typeof document === 'undefined') return;

	const cookie = document.cookie.split('; ').find((r) => r.startsWith(`${name}=`));
	if (!cookie) return;

	const value = cookie.split('=')[1];
	if (!value) return;
	return validator?.(value) ? (value as T) : undefined;
}

function setCookie(name: string, value: string): void {
	if (typeof document === 'undefined') return;

	const parts = [
		`${name}=${value}`,
		'path=/',
		`max-age=${COOKIE_MAX_AGE}`,
		'SameSite=Lax',
		...(window.location.protocol === 'https:' ? ['Secure'] : []),
	];

	// biome-ignore lint/suspicious/noDocumentCookie: Required for theme persistence
	document.cookie = parts.join('; ');
}

const isValidTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';

export const getThemeCookie = () => getCookie(THEME_COOKIE_NAME, isValidTheme);
export const getResolvedCookie = () => getCookie<ResolvedTheme>(RESOLVED_THEME_COOKIE_NAME);
export const setThemeCookie = (t: Theme) => setCookie(THEME_COOKIE_NAME, t);
export const setResolvedCookie = (t: ResolvedTheme) => setCookie(RESOLVED_THEME_COOKIE_NAME, t);

export const getSystemTheme = (): ResolvedTheme =>
	typeof window === 'undefined'
		? 'light'
		: window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';

export const resolveTheme = (preference: Theme): ResolvedTheme =>
	preference === 'system' ? getSystemTheme() : preference;

export function applyThemeClass(theme: ResolvedTheme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.remove('light', 'dark');
	document.documentElement.classList.add(theme);
}

export { isValidTheme };

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useThemeProvider(
	initialTheme: Theme = 'system',
	initialResolved: ResolvedTheme = 'light',
) {
	const [theme, setThemeState] = useState<Theme>(initialTheme);
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(initialResolved);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		const resolved = resolveTheme(newTheme);
		setResolvedTheme(resolved);

		setThemeCookie(newTheme);
		setResolvedCookie(resolved);

		applyThemeClass(resolved);
	};

	useEffect(() => {
		const cookieTheme = getThemeCookie() || initialTheme;
		const resolved = resolveTheme(cookieTheme);

		if (cookieTheme !== theme) setThemeState(cookieTheme);
		if (resolved !== resolvedTheme) {
			setResolvedTheme(resolved);
			applyThemeClass(resolved);
			setResolvedCookie(resolved);
		}
	}, [initialTheme, resolvedTheme, theme]);

	useEffect(() => {
		if (theme !== 'system') return;

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
			const newResolved = e.matches ? 'dark' : 'light';
			setResolvedTheme(newResolved);
			setResolvedCookie(newResolved);
			applyThemeClass(newResolved);
		};

		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, [theme]);

	return { theme, resolvedTheme, setTheme };
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error('useTheme must be used within ThemeProvider');
	return context;
}

export const THEME_COOKIE = THEME_COOKIE_NAME;
export const RESOLVED_COOKIE = RESOLVED_THEME_COOKIE_NAME;
