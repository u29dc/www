import localFont from 'next/font/local';

// Neue Haas Grotesk Display - Weights: 500 (Book), 600 (Medium)
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
