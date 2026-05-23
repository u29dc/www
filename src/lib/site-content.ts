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

export const originParagraphs = [
	'Most of the technology that will matter in the next decade is going to work. It will be funded, built, tested, deployed. The engineering question is being answered. The question that is not being answered - the one that shapes adoption, trust, policy, and public patience - is how it enters the world. What story surrounds it. Whether people who were not in the room can feel why it deserves belief.',
	'My background started in architecture, then moved through computational design at Salon, creative development at Lusion and Nohlab, and creative direction at Lotus during the shift from petrol to electric. I am now pointing that range to the structural layer where technical credibility either becomes meaning or does not.',
	'Incomplete Infinity is the practice I am building around that work. The name is deliberate. I am interested in structures that stay open enough to be entered, precise enough to be trusted, and strange enough to resist becoming another polished surface. Not completeness as closure, but incompleteness as a live architecture: something others can understand, inhabit, and extend.',
] as const;

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
		meta: '£4.8k/mo',
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
