import type { LinkMark } from './links';

export const markImages: Partial<Record<LinkMark, string>> = {
	'akbank-sanat': '/assets/marks/akbank-sanat.webp',
	lotus: '/assets/marks/lotus.webp',
	lusion: '/assets/marks/lusion.webp',
	nohlab: '/assets/marks/nohlab.webp',
	outernet: '/assets/marks/outernet.webp',
	porsche: '/assets/marks/porsche.webp',
	salon: '/assets/marks/salon.webp',
};

export const markClasses: Record<LinkMark, string> = {
	'akbank-sanat': 'bg-[#ed1c24]',
	infinity: 'bg-ink',
	lotus: 'bg-[oklch(96.86%_0.2046_109.77)]',
	lusion: 'bg-[oklch(28%_0.004_250)]',
	nohlab: 'bg-[oklch(42.32%_0.2896_265.17)]',
	outernet: 'bg-[#d5a137]',
	porsche: 'bg-[oklch(36%_0.004_250)]',
	salon: 'bg-[oklch(36%_0.004_250)]',
};
