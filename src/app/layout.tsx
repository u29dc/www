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
import { RESOLVED_COOKIE, THEME_COOKIE } from '@/lib/theme';
import '@/styles/globals.css';

export { metadata, viewport };

export interface RootLayoutProps {
	children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
	const headersList = await headers();
	const nonce = headersList.get('x-nonce') || undefined;

	const cookieStore = await cookies();
	const themeCookie = cookieStore.get(THEME_COOKIE);
	const resolvedThemeCookie = cookieStore.get(RESOLVED_COOKIE);
	const cookieTheme = themeCookie?.value as Theme | undefined;
	const resolvedTheme = resolvedThemeCookie?.value as ResolvedTheme | undefined;

	let themeClass = '';
	if (cookieTheme === 'light' || cookieTheme === 'dark') {
		themeClass = cookieTheme;
	} else if (cookieTheme === 'system' && resolvedTheme) {
		themeClass = resolvedTheme;
	}

	return (
		<html lang="en" className={`${themeClass} ${neueHaas.variable}`} suppressHydrationWarning>
			<head>{nonce && <meta property="csp-nonce" content={nonce} />}</head>
			<body className="min-h-screen font-sm">
				<CoreViewportFix />
				<CoreAppShell>
					<CoreThemeProvider
						initialTheme={cookieTheme || 'system'}
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
