import type { SiteLink } from './links';

export const originLinks = {
	practice: {
		label: 'Incomplete Infinity',
		href: 'https://linkedin.com/in/u29dc',
		mark: 'infinity',
	},
	lotus: {
		label: 'Lotus',
		href: 'https://www.instagram.com/lotuscars/',
		mark: 'lotus',
	},
	lusion: {
		label: 'Lusion',
		href: 'https://lusion.co/',
		mark: 'lusion',
	},
	nohlab: {
		label: 'Nohlab',
		href: 'https://nohlab.com/',
		mark: 'nohlab',
	},
	salon: {
		label: 'Salon',
		href: 'https://salonarchitects.com/',
		mark: 'salon',
	},
} as const satisfies Record<string, SiteLink>;

export const signals: SiteLink[] = [];

export const protocols = [
	{
		name: 'MAP',
		meta: '£2k · 48h',
		description: 'Audit coherence and return actionable routes forward',
	},
	{
		name: 'ARC',
		meta: '£15k-40k',
		description: 'Architecture for strategy, direction, and scalable artifacts',
	},
	{
		name: 'ADV',
		meta: '£5k-10k / mo',
		description: 'Ongoing counsel to keep shipped work narratively coherent',
	},
] as const;

export const connectLinks = {
	conversation: {
		label: 'Start a conversation',
		href: 'https://cal.com/u29dc/hey',
		meta: 'For premise-level questions before production begins',
		icon: 'calendar',
	},
	email: {
		label: 'han@u29dc.com',
		href: 'mailto:han@u29dc.com',
		meta: 'Email',
		icon: 'mail',
	},
	linkedin: {
		label: 'LinkedIn',
		href: 'https://linkedin.com/in/u29dc',
		meta: '@u29dc',
		icon: 'globe',
	},
	instagram: {
		label: 'Instagram',
		href: 'https://instagram.com/u29dc',
		meta: '@u29dc',
		icon: 'globe',
	},
} as const satisfies Record<string, SiteLink>;
