import localFont from 'next/font/local';

// Neue Haas Grotesk Display
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
	fallback: [
		'system-ui',
		'-apple-system',
		'BlinkMacSystemFont',
		'SF Pro',
		'Segoe UI',
		'Roboto',
		'Helvetica Neue',
		'Arial',
		'sans-serif',
	],
});

// Fira Code Variable
export const firaCode = localFont({
	src: './fonts/fira-code-variable-normal.woff2',
	variable: '--font-fira-code',
	display: 'swap',
	preload: true,
	fallback: [
		'SF Mono',
		'Cascadia Code',
		'Menlo',
		'Consolas',
		'Liberation Mono',
		'DejaVu Sans Mono',
		'Courier New',
		'monospace',
	],
});

// Professor Handwritten
export const professor = localFont({
	src: './fonts/professor-400-normal.woff2',
	variable: '--font-professor',
	display: 'swap',
	preload: true,
	fallback: ['cursive', 'sans-serif'],
});
