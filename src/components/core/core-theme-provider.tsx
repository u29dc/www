'use client';

/**
 * Core Theme Provider
 *
 * ## SUMMARY
 * Client-side theme context provider with cookie-based SSR synchronization.
 *
 * ## RESPONSIBILITIES
 * - Provide theme context and sync changes to cookies and HTML class
 *
 * @module components/core/core-theme-provider
 */

import type { ThemeProviderProps } from '@/lib/theme';
import { ThemeContext, useThemeProvider } from '@/lib/theme';

export function CoreThemeProvider({
	children,
	initialTheme = 'system',
	initialResolved = 'light',
}: ThemeProviderProps) {
	const themeValue = useThemeProvider(initialTheme, initialResolved);

	return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}
