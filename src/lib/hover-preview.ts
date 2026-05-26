import type { ArtifactEntry } from './artifacts';
import { getFirstArtifactImageMediaSource, getFirstArtifactMediaSource } from './markdown';
import { parseMediaSource, type MediaKind } from './media';

export type HoverPreviewFit = 'cover' | 'contain';

export type HoverPreview = {
	url: string;
	kind: MediaKind;
	ratio: number;
	fit: HoverPreviewFit;
	alt: string;
	posterUrl?: string;
};

const FALLBACK_PREVIEW_MEDIA = '/og.jpg';

const firstMediaOverride = (media: string | string[] | undefined): string | undefined => {
	if (Array.isArray(media)) return media[0];
	return media;
};

const imageSource = (source: string | undefined): string | undefined => {
	if (!source) return undefined;
	return parseMediaSource(source).kind === 'image' ? source : undefined;
};

export const resolveArtifactHoverPreview = (entry: ArtifactEntry): HoverPreview => {
	const source = firstMediaOverride(entry.data.hoverMedia) ?? getFirstArtifactMediaSource(entry) ?? entry.data.thumbnailMedia ?? FALLBACK_PREVIEW_MEDIA;
	const media = parseMediaSource(source);
	const posterSource =
		media.kind === 'video' ? (imageSource(entry.data.hoverPosterMedia) ?? imageSource(entry.data.thumbnailMedia) ?? getFirstArtifactImageMediaSource(entry) ?? FALLBACK_PREVIEW_MEDIA) : undefined;

	return {
		url: media.kind === 'image' ? media.previewUrl : media.displayUrl,
		kind: media.kind,
		ratio: media.ratio,
		fit: entry.data.hoverPreviewFit ?? 'cover',
		alt: entry.data.hoverPreviewAlt ?? entry.data.title,
		...(posterSource ? { posterUrl: parseMediaSource(posterSource).previewUrl } : media.posterUrl ? { posterUrl: media.posterUrl } : {}),
	};
};

export const resolveLinkHoverPreview = (source: string | undefined, options?: { alt?: string; fit?: HoverPreviewFit }): HoverPreview | undefined => {
	if (!source) return undefined;

	const media = parseMediaSource(source);
	return {
		url: media.kind === 'image' ? media.previewUrl : media.displayUrl,
		kind: media.kind,
		ratio: media.ratio,
		fit: options?.fit ?? 'cover',
		alt: options?.alt ?? '',
	};
};
