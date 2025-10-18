'use client';

/**
 * App Shell
 *
 * ## SUMMARY
 * Client component wrapper providing navigation mode context to the application.
 * Enables timeline-based animations throughout the app while preserving server
 * component benefits via thin client boundary.
 *
 * ## RESPONSIBILITIES
 * - Wrap application with NavigationModeProvider
 * - Enable animation timeline coordination across pages
 * - Preserve server component benefits
 *
 * ## USAGE
 * ```tsx
 * import { AppShell } from '@/components/base-app-shell';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AppShell>{children}</AppShell>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @module components/base-app-shell
 */

import type { ReactNode } from 'react';
import { NavigationModeProvider } from '@/lib/animation/timeline';

export interface AppShellProps {
	children: ReactNode;
}

/**
 * AppShell component
 *
 * Wraps the application with NavigationModeProvider for animation coordination.
 */
export function AppShell({ children }: AppShellProps) {
	return <NavigationModeProvider>{children}</NavigationModeProvider>;
}
