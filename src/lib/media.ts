import { MEDIA } from '../data/site';

export type MediaKind = 'image' | 'video';

export type MediaVariant = {
	label: 'sm' | 'md' | 'lg';
	width: 768 | 1280 | 2000;
	url: string;
};

export type MediaSource = {
	raw: string;
	path: string;
	url: string;
	displayUrl: string;
	previewUrl: string;
	ratio: number;
	kind: MediaKind;
	width: number;
	height: number;
	srcset?: string;
	sizes?: string;
	variants?: MediaVariant[];
	posterUrl?: string;
};

const DEFAULT_RATIO = 2;
const RESTRICTED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const IMAGE_VARIANTS: MediaVariant[] = [
	{ label: 'sm', width: 768, url: '' },
	{ label: 'md', width: 1280, url: '' },
	{ label: 'lg', width: 2000, url: '' },
];
const MEDIA_SIZES = 'min(calc(100vw - (var(--space-page) * 2)), var(--measure-media))';

const parseRatio = (source: string): { path: string; ratio: number } => {
	const match = source.match(/^(.+)@([0-9]+(?:\.[0-9]+)?)$/);
	if (!match) return { path: source, ratio: DEFAULT_RATIO };

	const path = match[1];
	const ratioText = match[2];
	if (!path || !ratioText) return { path: source, ratio: DEFAULT_RATIO };

	const ratio = Number.parseFloat(ratioText);
	if (!Number.isFinite(ratio) || ratio <= 0) {
		throw new Error(`Invalid media ratio in "${source}"`);
	}

	return { path, ratio };
};

const encodeRelativePath = (path: string): string =>
	path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');

const resolveMediaUrl = (path: string): string => {
	const trimmed = path.trim();
	if (trimmed.length === 0) {
		throw new Error('Media source cannot be empty');
	}

	try {
		const url = new URL(trimmed);
		if (RESTRICTED_PROTOCOLS.has(url.protocol)) {
			throw new Error(`Unsupported media protocol "${url.protocol}"`);
		}
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error(`Unsupported media protocol "${url.protocol}"`);
		}
		return url.href;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('Unsupported media protocol')) {
			throw error;
		}
	}

	if (trimmed.startsWith('/')) {
		return encodeURI(trimmed);
	}

	return new URL(encodeRelativePath(trimmed), MEDIA.baseUrl).href;
};

const isRemoteOrRootPath = (path: string): boolean => {
	const trimmed = path.trim();
	if (trimmed.startsWith('/')) return true;
	try {
		const url = new URL(trimmed);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
};

const getExtension = (path: string): string => {
	const pathname = path.split(/[?#]/, 1)[0] ?? path;
	const dotIndex = pathname.lastIndexOf('.');
	return dotIndex === -1 ? '' : pathname.slice(dotIndex).toLowerCase();
};

const stripExtension = (path: string): string => {
	const extension = getExtension(path);
	return extension ? path.slice(0, -extension.length) : path;
};

const optimizedPathBase = (path: string): string | undefined => {
	if (isRemoteOrRootPath(path) || path.includes('/')) return undefined;

	const name = stripExtension(path).trim();
	const separatorIndex = name.indexOf('_');
	if (separatorIndex <= 0) return undefined;

	const slug = name.slice(0, separatorIndex);
	const base = name.replaceAll('_', '-').replaceAll(/\s+/g, '-').toLowerCase();
	return `${slug}/${base}`;
};

const resolveOptimizedMediaUrl = (path: string): string | undefined => {
	const base = optimizedPathBase(path);
	if (!base) return undefined;
	const extension = getExtension(path);
	return resolveMediaUrl(`${base}${extension}`);
};

const buildImageVariants = (path: string): MediaVariant[] | undefined => {
	const base = optimizedPathBase(path);
	if (!base) return undefined;

	return IMAGE_VARIANTS.map((variant) => ({
		...variant,
		url: resolveMediaUrl(`${base}-${variant.label}.webp`),
	}));
};

const buildPosterUrl = (path: string): string | undefined => {
	const base = optimizedPathBase(path);
	if (!base) return undefined;
	return resolveMediaUrl(`${base}-poster.webp`);
};

export const parseMediaSource = (source: string): MediaSource => {
	const raw = source.trim();
	const { path, ratio } = parseRatio(raw);
	const url = resolveMediaUrl(path);
	const kind: MediaKind = VIDEO_EXTENSIONS.has(getExtension(path)) ? 'video' : 'image';
	const variants = kind === 'image' ? buildImageVariants(path) : undefined;
	const displayUrl = variants?.find((variant) => variant.label === 'md')?.url ?? resolveOptimizedMediaUrl(path) ?? url;
	const previewUrl = variants?.find((variant) => variant.label === 'sm')?.url ?? displayUrl;
	const posterUrl = kind === 'video' ? buildPosterUrl(path) : undefined;
	const height = 1000;
	const width = Math.max(1, Math.round(height * ratio));
	const srcset = variants?.map((variant) => `${variant.url} ${variant.width}w`).join(', ');

	return {
		raw,
		path,
		url,
		displayUrl,
		previewUrl,
		ratio,
		kind,
		width,
		height,
		...(srcset ? { srcset } : {}),
		...(srcset ? { sizes: MEDIA_SIZES } : {}),
		...(variants ? { variants } : {}),
		...(posterUrl ? { posterUrl } : {}),
	};
};

export const parseMediaSources = (source: string | string[]): MediaSource[] => {
	const sources = Array.isArray(source) ? source : [source];
	const parsed = sources.map(parseMediaSource);
	if (parsed.length === 0) {
		throw new Error('MdxMedia requires at least one source');
	}
	return parsed;
};
