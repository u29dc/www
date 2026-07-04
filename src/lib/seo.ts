import { SITE } from '../data/site';

export type SitePath = `/${string}`;

export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export type SitemapRoute = {
	path: SitePath;
	lastModified?: Date;
	changeFrequency?: ChangeFrequency;
	priority?: number;
};

export type FeedItem = {
	path: SitePath;
	title: string;
	description: string;
	date: Date;
	id?: string;
	tags?: string[];
	contentText?: string;
};

const SITE_PATH_ERROR = 'must be a root-relative path without protocol, query, hash, or backslash';
const SITE_LOCAL_ERROR = 'must be site-local without protocol or backslash';

export const isSitePath = (value: string): value is SitePath => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[?#]/.test(value);

export const assertSitePath = (value: string, label = 'site path'): SitePath => {
	if (isSitePath(value)) return value;
	throw new Error(`${label} ${SITE_PATH_ERROR}`);
};

export const normalizeSitePath = (value: string, label = 'site path'): SitePath => {
	if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//') || value.includes('\\')) {
		throw new Error(`${label} ${SITE_LOCAL_ERROR}`);
	}
	const [pathname = '/'] = value.split(/[?#]/);
	const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return assertSitePath(prefixed.replace(/\/+$/, '') || '/', label);
};

export const absoluteSiteUrl = (path: string, base = SITE.url): string => {
	const baseUrl = new URL(base);
	const url = new URL(assertSitePath(path), baseUrl);
	if (url.origin !== baseUrl.origin) throw new Error(`site path ${SITE_PATH_ERROR}`);
	return url.toString();
};

export const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export const sortFeedItems = (items: readonly FeedItem[]): FeedItem[] => [...items].toSorted((a, b) => b.date.getTime() - a.date.getTime());

export const latestFeedDate = (items: readonly FeedItem[], fallback = SITE.updatedAt): Date => sortFeedItems(items)[0]?.date ?? fallback;
