'use client';

/**
 * Theme Management System
 *
 * ## SUMMARY
 * Cookie-based theme system with SSR support, system preference sync, and FOUC prevention.
 *
 * ## RESPONSIBILITIES
 * - Persist user theme preferences via secure cookies
 * - Resolve system preferences and sync in real time
 * - Prevent flash of unstyled content on initial render
 * - Expose React context and hooks for theme toggling
 *
 * ## USAGE
 * ```tsx
 * import { ThemeContext, useThemeProvider, useTheme } from '@/lib/utils/theme';
 *
 * const themeValue = useThemeProvider();
 * <ThemeContext.Provider value={themeValue}>
 *   <ThemeToggle onClick={() => themeValue.setTheme('dark')} />
 * </ThemeContext.Provider>
 * ```
 *
 * @module lib/utils/theme
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { ResolvedTheme, Theme, ThemeContextValue } from '@/lib/types/utils';

// Cookie configuration
const THEME_COOKIE_NAME = 'www-theme';
const RESOLVED_THEME_COOKIE_NAME = 'www-resolved-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// ================================================================================================
// COOKIE UTILITIES
// ================================================================================================

/**
 * Generic cookie reader with optional type validation.
 * Returns undefined for SSR safety.
 */
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

/**
 * Generic cookie writer with secure defaults.
 * Applies SameSite=Lax, Secure (on HTTPS), and 1-year expiration.
 */
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

// Type guard for theme validation
const isValidTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system';

// Exported cookie functions
export const getThemeFromCookie = () => getCookie(THEME_COOKIE_NAME, isValidTheme);
export const getResolvedThemeFromCookie = () =>
	getCookie<ResolvedTheme>(RESOLVED_THEME_COOKIE_NAME);
export const saveThemeToCookie = (t: Theme) => setCookie(THEME_COOKIE_NAME, t);
export const saveResolvedThemeToCookie = (t: ResolvedTheme) =>
	setCookie(RESOLVED_THEME_COOKIE_NAME, t);

// ================================================================================================
// THEME LOGIC
// ================================================================================================

/**
 * Detect system color scheme preference via media query.
 * Returns 'light' for SSR safety.
 */
export const getSystemTheme = (): ResolvedTheme =>
	typeof window === 'undefined'
		? 'light'
		: window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';

/**
 * Resolve theme preference to concrete value.
 * Converts 'system' to actual 'light' or 'dark'.
 */
export const resolveTheme = (preference: Theme): ResolvedTheme =>
	preference === 'system' ? getSystemTheme() : preference;

/**
 * Apply theme class to document root.
 * Removes both classes before applying to prevent conflicts.
 */
export function applyThemeClass(theme: ResolvedTheme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.remove('light', 'dark');
	document.documentElement.classList.add(theme);
}

export { isValidTheme };

// ================================================================================================
// REACT CONTEXT & HOOKS
// ================================================================================================

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme provider hook with SSR hydration and system preference sync.
 *
 * Manages theme state, cookie persistence, and DOM updates. Hydrates from cookies
 * on mount and listens for system preference changes when theme is set to 'system'.
 */
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

		// Persist to cookies
		saveThemeToCookie(newTheme);
		saveResolvedThemeToCookie(resolved);

		// Apply to DOM immediately
		applyThemeClass(resolved);
	};

	// Hydrate from cookies on mount and sync with SSR values
	useEffect(() => {
		const cookieTheme = getThemeFromCookie() || initialTheme;
		const resolved = resolveTheme(cookieTheme);

		if (cookieTheme !== theme) setThemeState(cookieTheme);
		if (resolved !== resolvedTheme) {
			setResolvedTheme(resolved);
			applyThemeClass(resolved);
			saveResolvedThemeToCookie(resolved);
		}
	}, [initialTheme, resolvedTheme, theme]);

	// Listen for system theme changes when theme is 'system'
	useEffect(() => {
		if (theme !== 'system') return;

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
			const newResolved = e.matches ? 'dark' : 'light';
			setResolvedTheme(newResolved);
			saveResolvedThemeToCookie(newResolved);
			applyThemeClass(newResolved);
		};

		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, [theme]);

	return { theme, resolvedTheme, setTheme };
}

/**
 * Access theme context with runtime validation.
 * Throws error if used outside ThemeProvider.
 */
export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error('useTheme must be used within ThemeProvider');
	return context;
}

// Exported cookie names for middleware/layout usage
export const THEME_COOKIE = THEME_COOKIE_NAME;
export const RESOLVED_COOKIE = RESOLVED_THEME_COOKIE_NAME;
