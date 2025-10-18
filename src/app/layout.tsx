/**
 * Root Layout
 *
 * ## SUMMARY
 * Application root layout with base HTML structure and global metadata.
 *
 * ## RESPONSIBILITIES
 * - Define base HTML structure
 * - Export centralized metadata and viewport configuration
 * - Apply global styles and fonts
 * - Initialize CSP nonce system via dummy script (Next.js workaround)
 * - Wrap application with providers (future)
 *
 * ## USAGE
 * Automatically applied to all routes by Next.js App Router.
 *
 * @module app/layout
 */

import { cookies, headers } from 'next/headers';
import Script from 'next/script';
import { BaseGradientBlur } from '@/components/base-gradient-blur';
import { BaseThemeProvider } from '@/components/base-theme-provider';
import { BaseViewportFix } from '@/components/base-viewport-fix';
import { neueHaas } from '@/lib/fonts/local';
import { metadata, viewport } from '@/lib/meta/config';
import type { RootLayoutProps } from '@/lib/types/components';
import type { ResolvedTheme, Theme } from '@/lib/types/utils';

import { RESOLVED_COOKIE, THEME_COOKIE } from '@/lib/utils/theme';
import '@/styles/globals.css';

export { metadata, viewport };

export default async function RootLayout({ children }: RootLayoutProps) {
	// Extract nonce from proxy headers for CSP compliance
	const headersList = await headers();
	const nonce = headersList.get('x-nonce') || undefined;

	// Get theme from cookies for SSR
	const cookieStore = await cookies();
	const themeCookie = cookieStore.get(THEME_COOKIE);
	const resolvedThemeCookie = cookieStore.get(RESOLVED_COOKIE);
	const cookieTheme = themeCookie?.value as Theme | undefined;
	const resolvedTheme = resolvedThemeCookie?.value as ResolvedTheme | undefined;

	// Determine theme class for SSR to prevent FOUC
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
				<BaseViewportFix />
				<BaseThemeProvider
					initialTheme={cookieTheme || 'system'}
					initialResolved={(themeClass as ResolvedTheme) || 'light'}
				>
					{children}
					<BaseGradientBlur />
				</BaseThemeProvider>

				{nonce && <Script src="/empty.js" strategy="afterInteractive" nonce={nonce} />}
			</body>
		</html>
	);
}
