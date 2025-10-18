'use client';

/**
 * Core App Shell
 *
 * ## SUMMARY
 * Client wrapper providing navigation mode context for timeline-based animations.
 *
 * ## RESPONSIBILITIES
 * - Wrap application with NavigationModeProvider for animation coordination
 *
 * @module components/core/core-app-shell
 */

import type { ReactNode } from 'react';
import { NavigationModeProvider } from '@/lib/timeline';

export interface CoreAppShellProps {
	children: ReactNode;
}

export function CoreAppShell({ children }: CoreAppShellProps) {
	return <NavigationModeProvider>{children}</NavigationModeProvider>;
}
