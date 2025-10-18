'use client';

/**
 * Core Viewport Fix
 *
 * ## SUMMARY
 * Client-side CSS variable updater for accurate mobile viewport height.
 *
 * ## RESPONSIBILITIES
 * - Set --vh CSS variable on resize, orientation change, and Mobile Safari scroll events
 *
 * @module components/core/core-viewport-fix
 */

import { useEffect } from 'react';

/**
 * Update CSS --vh variable for visual viewport height on mobile browsers.
 * @returns Null (side-effect only component)
 */
export function CoreViewportFix(): null {
	useEffect(() => {
		let resizeTimeoutId: NodeJS.Timeout;
		let scrollTimeoutId: NodeJS.Timeout;

		const setVhVariable = () => {
			const height = window.visualViewport?.height ?? window.innerHeight;
			const vh = height * 0.01;
			document.documentElement.style.setProperty('--vh', `${vh}px`);
		};

		const setVhVariableThrottled = () => {
			clearTimeout(resizeTimeoutId);
			resizeTimeoutId = setTimeout(setVhVariable, 100);
		};

		setVhVariable();

		const events = ['resize', 'orientationchange'];

		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', setVhVariableThrottled);
		}

		events.forEach((event) => {
			window.addEventListener(event, setVhVariableThrottled);
		});

		const handleScroll = () => {
			clearTimeout(scrollTimeoutId);
			scrollTimeoutId = setTimeout(setVhVariable, 150);
		};

		const isMobileSafari =
			/iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
		if (isMobileSafari) {
			window.addEventListener('scroll', handleScroll, { passive: true });
		}

		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', setVhVariableThrottled);
			}

			events.forEach((event) => {
				window.removeEventListener(event, setVhVariableThrottled);
			});

			if (isMobileSafari) {
				window.removeEventListener('scroll', handleScroll);
			}

			clearTimeout(resizeTimeoutId);
			clearTimeout(scrollTimeoutId);
		};
	}, []);

	return null;
}
