export const LINK_ICONS = ['arrow', 'calendar', 'code', 'file', 'globe', 'layers', 'mail', 'mic', 'play', 'rss', 'youtube'] as const;
export const LINK_MARKS = ['akbank-sanat', 'infinity', 'instagram', 'linkedin', 'lotus', 'lusion', 'nohlab', 'outernet', 'porsche', 'salon'] as const;

export type LinkIcon = (typeof LINK_ICONS)[number];
export type LinkMark = (typeof LINK_MARKS)[number];

export type SiteLink = {
	href: string;
	label: string;
	meta?: string;
	icon?: LinkIcon;
	mark?: LinkMark;
	accent?: string;
	accentText?: string;
};
