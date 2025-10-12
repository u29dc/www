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
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/core/theme-provider';
import { ViewportHeightFix } from '@/components/core/viewport-height-fix';
import { BlurGradient } from '@/components/ui/blur-gradient';
import { metadata, viewport } from '@/lib/utils/metadata';
import { RESOLVED_COOKIE, type ResolvedTheme, THEME_COOKIE, type Theme } from '@/lib/utils/theme';
import '@/styles/globals.css';

export { metadata, viewport };

interface RootLayoutProps {
	children: ReactNode;
}

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
		<html lang="en" className={themeClass} suppressHydrationWarning>
			<head>
				<link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
				<link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
				<link rel="dns-prefetch" href="https://use.typekit.net" />
				<link rel="dns-prefetch" href="https://p.typekit.net" />
				<link rel="stylesheet" href="https://use.typekit.net/iui4tie.css" />

				{nonce && <meta property="csp-nonce" content={nonce} />}
			</head>
			<body className="min-h-screen font-sm">
				<ViewportHeightFix />
				<ThemeProvider
					initialTheme={cookieTheme || 'system'}
					initialResolved={(themeClass as ResolvedTheme) || 'light'}
				>
					{children}
					<BlurGradient />
				</ThemeProvider>

				{nonce && <Script src="/empty.js" strategy="afterInteractive" nonce={nonce} />}
			</body>
		</html>
	);
}
