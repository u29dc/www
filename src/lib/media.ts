import { MEDIA } from '../data/site';

export type MediaKind = 'image' | 'video';

export type MediaSource = {
	raw: string;
	path: string;
	url: string;
	ratio: number;
	kind: MediaKind;
	width: number;
	height: number;
};

const DEFAULT_RATIO = 2;
const RESTRICTED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);

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

const getExtension = (path: string): string => {
	const pathname = path.split(/[?#]/, 1)[0] ?? path;
	const dotIndex = pathname.lastIndexOf('.');
	return dotIndex === -1 ? '' : pathname.slice(dotIndex).toLowerCase();
};

export const parseMediaSource = (source: string): MediaSource => {
	const raw = source.trim();
	const { path, ratio } = parseRatio(raw);
	const url = resolveMediaUrl(path);
	const kind: MediaKind = VIDEO_EXTENSIONS.has(getExtension(path)) ? 'video' : 'image';
	const height = 1000;
	const width = Math.max(1, Math.round(height * ratio));

	return { raw, path, url, ratio, kind, width, height };
};

export const parseMediaSources = (source: string | string[]): MediaSource[] => {
	const sources = Array.isArray(source) ? source : [source];
	const parsed = sources.map(parseMediaSource);
	if (parsed.length === 0) {
		throw new Error('MdxMedia requires at least one source');
	}
	return parsed;
};
