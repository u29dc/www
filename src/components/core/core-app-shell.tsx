'use client';

/**
 * Core App Shell
 *
 * ## SUMMARY
 * Consolidated provider component integrating smooth scroll, theme management,
 * navigation context, and visual overlays.
 *
 * ## RESPONSIBILITIES
 * - Conditionally enable Lenis smooth scrolling based on device tier and motion preferences
 * - Provide navigation mode context for timeline-based animations
 * - Initialize theme system with next-themes
 * - Render grain and grid overlays
 *
 * ## KEY FLOWS
 * 1. Mount → detect device tier and motion preferences
 * 2. Conditionally wrap with ReactLenis for medium/high tier devices
 * 3. Layer providers: Lenis > NavigationMode > Theme
 * 4. Render children with grain and grid overlays
 *
 * @module components/core/core-app-shell
 */

import { ReactLenis } from 'lenis/react';
import { useReducedMotion } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useMemo } from 'react';
import { CoreGrainOverlay } from '@/components/core/core-grain-overlay';
import { useDeviceTier } from '@/lib/performance';
import { NavigationModeProvider } from '@/lib/timeline';

export interface CoreAppShellProps {
	children: ReactNode;
}

export function CoreAppShell({ children }: CoreAppShellProps) {
	// Device-aware smooth scroll (reactive to motion preference changes)
	const tier = useDeviceTier();
	const prefersReducedMotion = useReducedMotion();

	// Enable Lenis smooth scrolling for medium/high tier devices without reduced motion
	const shouldUseLenis = useMemo(
		() => tier !== 'low' && !prefersReducedMotion,
		[tier, prefersReducedMotion],
	);

	// Provider composition: NavigationMode > Theme > Content + Overlays
	const content = (
		<NavigationModeProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				enableSystem={false}
				disableTransitionOnChange={true}
			>
				{children}

				<CoreGrainOverlay
					intensity={0.5}
					grainScale={5.0}
					animationSpeed={0.1}
					exposure={0.1}
				/>
				<div className="grid-overlay" aria-hidden="true" />
			</ThemeProvider>
		</NavigationModeProvider>
	);

	// Conditionally wrap with Lenis for capable devices
	if (!shouldUseLenis) {
		return <>{content}</>;
	}

	return (
		<ReactLenis root options={{ lerp: 0.05 }}>
			{content}
		</ReactLenis>
	);
}
