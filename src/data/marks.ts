import type { LinkMark } from './links';
import akbankMark from '../assets/akbank.webp?inline';
import instagramMark from '../assets/instagram.webp?inline';
import linkedinMark from '../assets/linkedin.webp?inline';
import lotusMark from '../assets/lotus.webp?inline';
import lusionMark from '../assets/lusion.webp?inline';
import nohlabMark from '../assets/nohlab.webp?inline';
import outernetMark from '../assets/outernet.webp?inline';
import porscheMark from '../assets/porsche.webp?inline';
import salonMark from '../assets/salon.webp?inline';

type MarkStyle = {
	fallbackClass: string;
	image?: string;
	accent?: string;
	accentText?: string;
};

export const markStyles: Record<LinkMark, MarkStyle> = {
	'akbank-sanat': {
		fallbackClass: 'bg-[#ed1c24]',
		image: akbankMark,
		accent: '#ed1c24',
		accentText: '#ffffff',
	},
	infinity: {
		fallbackClass: 'bg-ink',
	},
	instagram: {
		fallbackClass: 'bg-[#e4405f]',
		image: instagramMark,
		accent: '#e4405f',
		accentText: '#ffffff',
	},
	linkedin: {
		fallbackClass: 'bg-[#2867b2]',
		image: linkedinMark,
		accent: '#2867b2',
		accentText: '#ffffff',
	},
	lotus: {
		fallbackClass: 'bg-[oklch(96.86%_0.2046_109.77)]',
		image: lotusMark,
		accent: 'oklch(96.86% 0.2046 109.77)',
		accentText: 'oklch(17.5% 0.003 250)',
	},
	lusion: {
		fallbackClass: 'bg-[oklch(28%_0.004_250)]',
		image: lusionMark,
		accent: '#111111',
		accentText: '#ffffff',
	},
	nohlab: {
		fallbackClass: 'bg-[oklch(42.32%_0.2896_265.17)]',
		image: nohlabMark,
		accent: '#0000ff',
		accentText: '#ffffff',
	},
	outernet: {
		fallbackClass: 'bg-[#d5a137]',
		image: outernetMark,
		accent: '#d5a137',
		accentText: '#111111',
	},
	porsche: {
		fallbackClass: 'bg-[oklch(36%_0.004_250)]',
		image: porscheMark,
		accent: '#d5001c',
		accentText: '#ffffff',
	},
	salon: {
		fallbackClass: 'bg-[oklch(36%_0.004_250)]',
		image: salonMark,
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
