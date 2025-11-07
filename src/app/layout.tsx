/**
 * Root Layout
 *
 * ## SUMMARY
 * Application root layout with base HTML structure, global metadata, and SSR theme support.
 *
 * ## RESPONSIBILITIES
 * - Apply global styles, fonts, and SSR theme class to prevent FOUC
 * - Initialize CSP nonce system and consolidated app shell
 *
 * @module app/layout
 */

import { headers } from 'next/headers';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { CoreAppShell } from '@/components/core/core-app-shell';
import { CoreViewportFix } from '@/components/core/core-viewport-fix';
import { metadata, viewport } from '@/lib/constants';
import { firaCode, neueHaas, professor } from '@/lib/fonts';
import '@/styles/globals.css';

export { metadata, viewport };

export interface RootLayoutProps {
	children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
	const headersList = await headers();
	const nonce = headersList.get('x-nonce') || undefined;

	return (
		<html
			lang="en"
			className={`${neueHaas.variable} ${firaCode.variable} ${professor.variable}`}
			suppressHydrationWarning
		>
			<head>{nonce && <meta property="csp-nonce" content={nonce} />}</head>
			<body className="min-h-screen font-sm">
				<CoreViewportFix />
				<CoreAppShell>{children}</CoreAppShell>

				{nonce && <Script src="/empty.js" strategy="afterInteractive" nonce={nonce} />}
			</body>
		</html>
	);
}
