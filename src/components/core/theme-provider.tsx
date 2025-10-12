/**
 * Theme Provider Component
 *
 * ## SUMMARY
 * Client-side theme context provider with cookie-based SSR synchronization.
 *
 * ## RESPONSIBILITIES
 * - Read theme from cookies on mount
 * - Provide theme context to all child components
 * - Sync theme changes to cookies and HTML class
 * - Handle system preference changes
 *
 * ## USAGE
 * ```tsx
 * // In layout.tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 *
 * @module components/core/theme-provider
 */

'use client';

import { ThemeContext, type ThemeProviderProps, useThemeProvider } from '@/lib/utils/theme';

export function ThemeProvider({
	children,
	initialTheme = 'system',
	initialResolved = 'light',
}: ThemeProviderProps) {
	const themeValue = useThemeProvider(initialTheme, initialResolved);

	return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}
