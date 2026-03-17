import { SITE } from '$lib/constants';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const TWITTER_CARD = 'summary_large_image' as const;

type OgType = 'website' | 'article';

type SeoImage = {
	url: string;
	width: number;
	height: number;
	alt: string;
};

export interface SeoMeta {
	browserTitle: string;
	description: string;
	canonical: string;
	openGraph: {
		type: OgType;
		url: string;
		title: string;
		description: string;
		siteName: string;
		image: SeoImage;
	};
	twitter: {
		card: typeof TWITTER_CARD;
		title: string;
		description: string;
		image: Pick<SeoImage, 'url' | 'alt'>;
	};
}

const absolute = (path: string): string => new URL(path, SITE.url).toString();

export function buildHomeSeo(): SeoMeta {
	const title = SITE.title;
	const description = SITE.description;
	const canonical = absolute('/');
	const image = {
		url: absolute('/og.png'),
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		alt: `${SITE.title} social card`,
	};

	return {
		browserTitle: title,
		description,
		canonical,
		openGraph: {
			type: 'website',
			url: canonical,
			title,
			description,
			siteName: SITE.name,
			image,
		},
		twitter: {
			card: TWITTER_CARD,
			title,
			description,
			image: {
				url: image.url,
				alt: image.alt,
			},
		},
	};
}

export function buildArtifactSeo({ slug, title, description, ogImageAlt }: { slug: string; title: string; description: string; ogImageAlt?: string }): SeoMeta {
	const canonical = absolute(`/${slug}`);
	const image = {
		url: absolute(`/${slug}/og.png`),
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		alt: ogImageAlt ?? `${title} social card`,
	};

	return {
		browserTitle: `${SITE.name} | ${title}`,
		description,
		canonical,
		openGraph: {
			type: 'article',
			url: canonical,
			title,
			description,
			siteName: SITE.name,
			image,
		},
		twitter: {
			card: TWITTER_CARD,
			title,
			description,
			image: {
				url: image.url,
				alt: image.alt,
			},
		},
	};
}
