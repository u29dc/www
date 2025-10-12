import localFont from 'next/font/local';

/**
 * Neue Haas Grotesk Display - Self-hosted font configuration
 *
 * Previously loaded from Adobe Typekit, now self-hosted for optimal performance.
 * Eliminates FOUC
 *
 * Font weights:
 * - 500: Book (normal + italic)
 * - 600: Medium (normal)
 *
 * Source: Adobe Typekit (kit iui4tie)
 * Downloaded: 2025-10-12
 */
export const neueHaas = localFont({
	src: [
		{
			path: './fonts/neue-haas-grotesk-display-500-normal.woff2',
			weight: '500',
			style: 'normal',
		},
		{
			path: './fonts/neue-haas-grotesk-display-500-italic.woff2',
			weight: '500',
			style: 'italic',
		},
		{
			path: './fonts/neue-haas-grotesk-display-600-normal.woff2',
			weight: '600',
			style: 'normal',
		},
	],
	variable: '--font-neue-haas',
	display: 'swap',
	preload: true,
	fallback: ['system-ui', 'sans-serif'],
});
