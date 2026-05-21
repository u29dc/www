const normalizeBaseUrl = (value: string): string => {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new Error('PUBLIC_MEDIA_BASE_URL cannot be empty');
	}
	return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
};

export const SITE = {
	name: 'Incomplete Infinity',
	description: 'A public thinking surface and commercial trust surface for U29DC.',
	url: 'https://u29dc.com',
} as const;

export const MEDIA = {
	baseUrl: normalizeBaseUrl(import.meta.env['PUBLIC_MEDIA_BASE_URL'] ?? 'https://storage.u29dc.com/media/'),
} as const;
