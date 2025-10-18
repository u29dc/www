/**
 * Base Viewport Height Fix Component
 *
 * ## SUMMARY
 * Client-side CSS variable updater for accurate mobile viewport height.
 *
 * ## RESPONSIBILITIES
 * - Set --vh CSS variable to 1% of actual viewport height
 * - Update on window resize and orientation change
 * - Fix Mobile Safari viewport height inconsistencies
 *
 * ## USAGE
 * ```tsx
 * // In layout.tsx
 * <BaseViewportFix />
 * ```
 *
 * @module components/base-viewport-fix
 */

'use client';

import { useEffect } from 'react';

/**
 * Update the CSS `--vh` variable to reflect the visual viewport height, accounting for mobile browser chrome.
 *
 * @returns Null; component is side-effect only.
 */
export function BaseViewportFix(): null {
	useEffect(() => {
		let resizeTimeoutId: NodeJS.Timeout;
		let scrollTimeoutId: NodeJS.Timeout;

		const setVhVariable = () => {
			// Use visualViewport API if available (better for iOS Safari)
			const height = window.visualViewport?.height ?? window.innerHeight;
			const vh = height * 0.01;
			document.documentElement.style.setProperty('--vh', `${vh}px`);
		};

		const setVhVariableThrottled = () => {
			// Throttle updates to prevent excessive recalculations
			clearTimeout(resizeTimeoutId);
			resizeTimeoutId = setTimeout(setVhVariable, 100);
		};

		// Initial calculation
		setVhVariable();

		// Enhanced event listeners for iOS Safari
		const events = ['resize', 'orientationchange'];

		// Add visual viewport listeners if supported
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', setVhVariableThrottled);
		}

		// Traditional event listeners with throttling
		events.forEach((event) => {
			window.addEventListener(event, setVhVariableThrottled);
		});

		// Additional iOS Safari specific handling
		// Handle iOS Safari address bar hide/show with slight delay
		const handleScroll = () => {
			clearTimeout(scrollTimeoutId);
			scrollTimeoutId = setTimeout(setVhVariable, 150);
		};

		// Only add scroll listener on mobile Safari
		const isMobileSafari =
			/iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
		if (isMobileSafari) {
			window.addEventListener('scroll', handleScroll, { passive: true });
		}

		return () => {
			// Cleanup
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', setVhVariableThrottled);
			}

			events.forEach((event) => {
				window.removeEventListener(event, setVhVariableThrottled);
			});

			if (isMobileSafari) {
				window.removeEventListener('scroll', handleScroll);
			}

			// Clear any pending timeouts
			clearTimeout(resizeTimeoutId);
			clearTimeout(scrollTimeoutId);
		};
	}, []);

	return null;
}
