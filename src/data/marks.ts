import type { LinkMark } from './links';

type MarkStyle = {
	fallbackClass: string;
	image?: string;
	accent?: string;
	accentText?: string;
};

export const markStyles: Record<LinkMark, MarkStyle> = {
	'akbank-sanat': {
		fallbackClass: 'bg-[#ed1c24]',
		image: '/assets/marks/akbank-sanat.webp',
		accent: '#ed1c24',
		accentText: '#ffffff',
	},
	infinity: {
		fallbackClass: 'bg-ink',
	},
	instagram: {
		fallbackClass: 'bg-[#e4405f]',
		image: '/assets/marks/instagram.webp',
		accent: '#e4405f',
		accentText: '#ffffff',
	},
	linkedin: {
		fallbackClass: 'bg-[#2867b2]',
		image: '/assets/marks/linkedin.webp',
		accent: '#2867b2',
		accentText: '#ffffff',
	},
	lotus: {
		fallbackClass: 'bg-[oklch(96.86%_0.2046_109.77)]',
		image: '/assets/marks/lotus.webp',
		accent: 'oklch(96.86% 0.2046 109.77)',
		accentText: 'oklch(17.5% 0.003 250)',
	},
	lusion: {
		fallbackClass: 'bg-[oklch(28%_0.004_250)]',
		image: '/assets/marks/lusion.webp',
		accent: '#111111',
		accentText: '#ffffff',
	},
	nohlab: {
		fallbackClass: 'bg-[oklch(42.32%_0.2896_265.17)]',
		image: '/assets/marks/nohlab.webp',
		accent: '#0000ff',
		accentText: '#ffffff',
	},
	outernet: {
		fallbackClass: 'bg-[#d5a137]',
		image: '/assets/marks/outernet.webp',
		accent: '#d5a137',
		accentText: '#111111',
	},
	porsche: {
		fallbackClass: 'bg-[oklch(36%_0.004_250)]',
		image: '/assets/marks/porsche.webp',
		accent: '#d5001c',
		accentText: '#ffffff',
	},
	salon: {
		fallbackClass: 'bg-[oklch(36%_0.004_250)]',
		image: '/assets/marks/salon.webp',
		accent: '#111111',
		accentText: '#ffffff',
	},
};

export const markImages = Object.fromEntries(
	Object.entries(markStyles)
		.filter((entry) => Boolean(entry[1].image))
		.map(([key, value]) => [key, value.image]),
) as Partial<Record<LinkMark, string>>;

export const markClasses = Object.fromEntries(Object.entries(markStyles).map(([key, value]) => [key, value.fallbackClass])) as Record<LinkMark, string>;
