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
	porsche: {
		label: 'Porsche',
		href: 'https://www.porsche.com/',
		mark: 'porsche',
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
	artificialRome: {
		label: 'Artificial Rome',
		href: 'https://artificialrome.com/',
	},
	outernet: {
		label: 'Outernet London',
		href: 'https://www.outernet.com/',
		mark: 'outernet',
	},
	ntmofa: {
		label: 'National Taiwan Museum of Fine Arts',
		href: 'https://www.ntmofa.gov.tw/en/',
	},
	akbankSanat: {
		label: 'Akbank Sanat',
		href: 'https://www.akbanksanat.com/en',
		mark: 'akbank-sanat',
	},
	battersea: {
		label: 'Battersea Power Station',
		href: 'https://batterseapowerstation.co.uk/',
	},
} as const satisfies Record<string, SiteLink>;

export const signals: SiteLink[] = [];

export const originParagraphs = [
	'Most of the technology that will matter in the next decade is already becoming possible. The machines will run. The tech will work. The prototypes will become products. What remains is the passage into the world: belief, adoption, permission, memory, demand. A future can be engineered and still fail to become imaginable to the people who have to fund it, buy it, work on it, regulate it, defend it, or live beside it.',
	'I have spent the last decade working around that passage: from architecture at Salon to arts and media at Nohlab, creative engineering at Lusion and Artificial Rome, cultural and immersive projects across Porsche, Outernet London, the National Taiwan Museum of Fine Arts, Akbank Sanat, and Battersea Power Station, then creative direction at Lotus during the shift from petrol to electric. Different rooms, different mediums, same pressure: something difficult trying to become visible without becoming smaller.',
	'I am narrowing that range now through Incomplete Infinity, for companies whose work is too consequential to remain trapped inside technical explanation. Energy, climate, robotics: fields where the proof is hard-won, but proof alone rarely carries far enough. The work is narrative architecture, creative strategy, and proof-making for the fragile passage between what has been built and what the world is ready to believe.',
	'The name is deliberate. Complete systems close. Incomplete ones invite participation. I am interested in structures open enough to be entered, precise enough to be trusted, and strange enough to resist becoming another polished surface. Structures that can hold a technical claim, a commercial decision, and a human reason for caring at the same time.',
] as const;

export const protocols = [
	{
		name: 'MAP',
		description: 'Audit coherence and return actionable routes forward',
	},
	{
		name: 'ARC',
		description: 'Architecture for strategy, direction, and scalable artifacts',
	},
	{
		name: 'ADV',
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
		mark: 'linkedin',
	},
	instagram: {
		label: 'Instagram',
		href: 'https://instagram.com/u29dc',
		meta: '@u29dc',
		mark: 'instagram',
	},
} as const satisfies Record<string, SiteLink>;
