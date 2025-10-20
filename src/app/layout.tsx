/**
 * Root Layout
 *
 * ## SUMMARY
 * Application root layout with base HTML structure, global metadata, and SSR theme support.
 *
 * ## RESPONSIBILITIES
 * - Apply global styles, fonts, and SSR theme class to prevent FOUC
 * - Initialize CSP nonce system and theme providers
 *
 * @module app/layout
 */

import { cookies, headers } from 'next/headers';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { CoreAppShell } from '@/components/core/core-app-shell';
import { CoreThemeProvider } from '@/components/core/core-theme-provider';
import { CoreViewportFix } from '@/components/core/core-viewport-fix';
import { metadata, viewport } from '@/lib/constants';
import { neueHaas } from '@/lib/fonts';
import type { ResolvedTheme, Theme } from '@/lib/theme';
import { isValidTheme, RESOLVED_COOKIE, THEME_COOKIE } from '@/lib/theme';
import '@/styles/globals.css';

export { metadata, viewport };

export interface RootLayoutProps {
	children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
	// Theme resolution: proxy headers (validated) → cookies (validated fallback) → 'system' (default) → SSR class on <html>
	const headersList = await headers();
	const nonce = headersList.get('x-nonce') || undefined;

	const headerTheme = headersList.get('u29dc-theme') as Theme | null;
	const headerResolvedTheme = headersList.get('u29dc-resolved-theme') as ResolvedTheme | null;

	// Defensive fallback: validate cookies only if headers absent
	const cookieStore = await cookies();
	const themeCookie = cookieStore.get(THEME_COOKIE);
	const resolvedThemeCookie = cookieStore.get(RESOLVED_COOKIE);

	const cookieTheme =
		themeCookie?.value && isValidTheme(themeCookie.value)
			? (themeCookie.value as Theme)
			: undefined;
	const cookieResolvedTheme =
		resolvedThemeCookie?.value === 'light' || resolvedThemeCookie?.value === 'dark'
			? (resolvedThemeCookie.value as ResolvedTheme)
			: undefined;

	// Priority: proxy headers (validated) → cookies (validated fallback) → 'system' (default)
	const theme = headerTheme || cookieTheme || 'system';
	const resolvedTheme = headerResolvedTheme || cookieResolvedTheme;

	// Compute SSR theme class
	let themeClass = '';
	if (theme === 'light' || theme === 'dark') {
		themeClass = theme;
	} else if (theme === 'system' && resolvedTheme) {
		themeClass = resolvedTheme;
	}

	return (
		<html lang="en" className={`${themeClass} ${neueHaas.variable}`} suppressHydrationWarning>
			<head>{nonce && <meta property="csp-nonce" content={nonce} />}</head>
			<body className="min-h-screen font-sm">
				<CoreViewportFix />
				<CoreAppShell>
					<CoreThemeProvider
						initialTheme={theme}
						initialResolved={(themeClass as ResolvedTheme) || 'light'}
					>
						{children}
						<AtomicGradientBlur />
					</CoreThemeProvider>
				</CoreAppShell>

				{nonce && <Script src="/empty.js" strategy="afterInteractive" nonce={nonce} />}
			</body>
		</html>
	);
}
