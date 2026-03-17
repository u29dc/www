import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { CDN, SITE } from '$lib/constants';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '$lib/server/seo';

export type OgTextTone = 'auto' | 'light' | 'dark';

export interface OgCardConfig {
	id?: string;
	title: string;
	source?: string;
	textTone?: OgTextTone;
}

const HOME_OG_SOURCE = `${CDN.mediaUrl}_HERO.webp`;
const FONT_PATH = resolve(process.cwd(), 'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff');
const TITLE_REGION = {
	left: 0.2,
	top: 0.26,
	width: 0.6,
	height: 0.34,
};
const LIGHT_TEXT = '#f8f9fa';
const DARK_TEXT = '#111315';

let serifFontPromise: Promise<Buffer> | null = null;

const getSerifFont = async (): Promise<Buffer> => {
	serifFontPromise ??= readFile(FONT_PATH);
	return serifFontPromise;
};

const resolveSourceUrl = (source: string): URL => {
	if (/^https?:\/\//i.test(source)) {
		return new URL(source);
	}

	return new URL(source, CDN.mediaUrl);
};

const fetchSourceBuffer = async (source: string): Promise<Buffer> => {
	if (source.startsWith('/')) {
		return readFile(resolve(process.cwd(), 'static', source.slice(1)));
	}

	const url = resolveSourceUrl(source);
	const headers = new Headers();
	if (url.hostname === CDN.hostname) {
		headers.set('Referer', `${SITE.url}/`);
	}

	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`Failed to fetch OG source ${url} (${response.status})`);
	}

	return Buffer.from(await response.arrayBuffer());
};

const getTitleFontSize = (title: string): number => {
	if (title.length > 78) return 56;
	if (title.length > 58) return 64;
	if (title.length > 40) return 72;
	return 80;
};

const getTextToneFromLuminance = (luminance: number): 'light' | 'dark' => (luminance > 150 ? 'dark' : 'light');

const detectAutoTone = async (imageBuffer: Buffer): Promise<'light' | 'dark'> => {
	const left = Math.round(OG_IMAGE_WIDTH * TITLE_REGION.left);
	const top = Math.round(OG_IMAGE_HEIGHT * TITLE_REGION.top);
	const width = Math.round(OG_IMAGE_WIDTH * TITLE_REGION.width);
	const height = Math.round(OG_IMAGE_HEIGHT * TITLE_REGION.height);
	const stats = await sharp(imageBuffer).extract({ left, top, width, height }).stats();

	const [red, green, blue] = stats.channels;
	if (!red || !green || !blue) {
		return 'light';
	}

	const luminance = red.mean * 0.2126 + green.mean * 0.7152 + blue.mean * 0.0722;
	return getTextToneFromLuminance(luminance);
};

const normalizeSourceImage = async (sourceBuffer: Buffer): Promise<Buffer> => {
	return sharp(sourceBuffer)
		.rotate()
		.resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
			fit: 'cover',
			position: 'centre',
		})
		.jpeg({
			quality: 86,
			mozjpeg: true,
		})
		.toBuffer();
};

const toDataUrl = (buffer: Buffer): string => `data:image/jpeg;base64,${buffer.toString('base64')}`;

const describeCard = (title: string, id?: string): string => (id ? `"${id}" (${title})` : `"${title}"`);

const prepareSourceImage = async (source: string): Promise<{ imageDataUrl: string; autoTone: 'light' | 'dark' }> => {
	const normalizedImage = await normalizeSourceImage(await fetchSourceBuffer(source));
	let autoTone: 'light' | 'dark' = 'light';

	try {
		autoTone = await detectAutoTone(normalizedImage);
	} catch {
		autoTone = 'light';
	}

	return {
		imageDataUrl: toDataUrl(normalizedImage),
		autoTone,
	};
};

const buildCardMarkup = ({ title, imageDataUrl, fontSize, resolvedTone }: { title: string; imageDataUrl?: string; fontSize: number; resolvedTone: 'light' | 'dark' }) => {
	const textColor = resolvedTone === 'light' ? LIGHT_TEXT : DARK_TEXT;
	const overlayBackground =
		resolvedTone === 'light' ? 'linear-gradient(180deg, rgba(17,19,21,0.12) 0%, rgba(17,19,21,0.30) 100%)' : 'linear-gradient(180deg, rgba(248,249,250,0.04) 0%, rgba(248,249,250,0.18) 100%)';
	const titleShadow = resolvedTone === 'light' ? '0 4px 36px rgba(0, 0, 0, 0.35)' : '0 3px 28px rgba(248, 249, 250, 0.24)';
	const children: Array<Record<string, unknown>> = [];

	if (imageDataUrl) {
		children.push({
			type: 'img',
			props: {
				src: imageDataUrl,
				style: {
					position: 'absolute',
					top: '0px',
					left: '0px',
					width: '100%',
					height: '100%',
					objectFit: 'cover',
				},
			},
		});
	}

	children.push(
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					position: 'absolute',
					top: '0px',
					left: '0px',
					width: '100%',
					height: '100%',
					backgroundImage: overlayBackground,
				},
			},
		},
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					position: 'absolute',
					top: '0px',
					left: '0px',
					width: '100%',
					height: '100%',
					alignItems: 'center',
					justifyContent: 'center',
					paddingLeft: '132px',
					paddingRight: '132px',
				},
				children: {
					type: 'div',
					props: {
						style: {
							display: 'flex',
							maxWidth: '816px',
							color: textColor,
							fontFamily: 'Instrument Serif',
							fontStyle: 'italic',
							fontSize: `${fontSize}px`,
							lineHeight: 1.02,
							letterSpacing: '-0.04em',
							textAlign: 'center',
							textShadow: titleShadow,
						},
						children: title,
					},
				},
			},
		},
	);

	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				position: 'relative',
				width: `${OG_IMAGE_WIDTH}px`,
				height: `${OG_IMAGE_HEIGHT}px`,
				overflow: 'hidden',
				backgroundColor: '#111315',
			},
			children,
		},
	};
};

export const getHomeOgSource = (): string => HOME_OG_SOURCE;

export async function renderOgCard({ id, title, source, textTone = 'auto' }: OgCardConfig): Promise<Uint8Array> {
	const font = await getSerifFont();
	const fontSize = getTitleFontSize(title);
	let imageDataUrl: string | undefined;
	let autoTone: 'light' | 'dark' = 'light';

	if (source) {
		try {
			const preparedImage = await prepareSourceImage(source);
			imageDataUrl = preparedImage.imageDataUrl;
			autoTone = preparedImage.autoTone;
		} catch (error) {
			const message = `Failed to prepare explicit OG source for ${describeCard(title, id)} from "${source}"`;
			throw new Error(message, {
				cause: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	const resolvedTone = textTone === 'auto' ? autoTone : textTone;
	const markup = buildCardMarkup({
		title,
		fontSize,
		resolvedTone,
		...(imageDataUrl ? { imageDataUrl } : {}),
	});
	const svg = await satori(markup, {
		width: OG_IMAGE_WIDTH,
		height: OG_IMAGE_HEIGHT,
		fonts: [
			{
				name: 'Instrument Serif',
				data: font,
				weight: 400,
				style: 'italic',
			},
		],
	});

	return new Resvg(svg).render().asPng();
}
