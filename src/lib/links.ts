export const LINK_ICONS = ['arrow', 'calendar', 'code', 'file', 'globe', 'layers', 'mail', 'mic', 'play', 'rss', 'youtube'] as const;
export const LINK_MARKS = ['infinity', 'lotus', 'lusion', 'nohlab', 'salon'] as const;

export type LinkIcon = (typeof LINK_ICONS)[number];
export type LinkMark = (typeof LINK_MARKS)[number];

export type SiteLink = {
	href: string;
	label: string;
	meta?: string;
	icon?: LinkIcon;
	mark?: LinkMark;
};
