const normalizeBaseUrl = (value: string): string => {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new Error('PUBLIC_MEDIA_BASE_URL cannot be empty');
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error('PUBLIC_MEDIA_BASE_URL must be an absolute URL');
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error('PUBLIC_MEDIA_BASE_URL must use http or https');
	}

	if (url.username || url.password || url.search || url.hash) {
		throw new Error('PUBLIC_MEDIA_BASE_URL must not include credentials, query, or hash');
	}

	url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
	return url.toString();
};

export const SITE = {
	title: 'Han (Incomplete Infinity)',
	name: 'Incomplete Infinity',
	description: 'We turn complex futures into decision-grade narratives',
	url: 'https://u29dc.com',
	locale: 'en_GB',
	lang: 'en-GB',
	themeColorLight: '#f7f7f7',
	themeColorDark: '#18191b',
	backgroundColor: '#f7f7f7',
	keywords: ['narrative architecture', 'creative strategy', 'design engineering', 'climate technology', 'industrial AI', 'robotics'],
	creator: 'u29dc',
	ogImagePath: '/og.jpg',
	ogImageType: 'image/jpeg',
} as const;

export const MEDIA = {
	baseUrl: normalizeBaseUrl(import.meta.env['PUBLIC_MEDIA_BASE_URL'] ?? 'https://storage.u29dc.com/assets/'),
} as const;

export const SITE_THEME = import.meta.env['PUBLIC_SITE_THEME'];
