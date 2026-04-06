import type { FragmentContent, Meta, ParsedContent, SignalContent, StudyContent } from '$lib/content-types';
import { extractMediaFromContent, getArtifactsContent } from '$lib/server/content';
import { buildHomeSeo } from '$lib/server/seo';
import type { HomeArtifactGroups, HomeOtherArtifactRow, HomeStudyArtifactRow, HomeWritingArtifactRow } from '$lib/types/artifacts';

const IMAGE_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif']);
const MAX_STUDY_THUMBNAILS = 4;

const isImageAsset = (filename: string | undefined): boolean => {
	if (!filename) return false;
	const normalized = filename.replace(/@[\d.]+$/, '');
	const extension = normalized.toLowerCase().split('.').pop();
	return extension ? IMAGE_EXTENSIONS.has(extension) : false;
};

const normalizeMediaKey = (filename: string): string => filename.replace(/@[\d.]+$/, '');

const collectStudyThumbnails = (item: ParsedContent & { frontmatter: StudyContent }): string[] => {
	const candidates = [item.frontmatter.thumbnailMedia, item.frontmatter.ogImage, ...extractMediaFromContent(item.content)];

	const thumbnails: string[] = [];
	const seen = new Set<string>();

	for (const candidate of candidates) {
		if (!candidate || !isImageAsset(candidate)) continue;

		const normalized = normalizeMediaKey(candidate);
		if (seen.has(normalized)) continue;

		seen.add(normalized);
		thumbnails.push(candidate);

		if (thumbnails.length >= MAX_STUDY_THUMBNAILS) {
			break;
		}
	}

	return thumbnails;
};

const isStudyEntry = (item: ParsedContent): item is ParsedContent & { frontmatter: StudyContent } => item.frontmatter.type === 'study';

const isFragmentEntry = (item: ParsedContent): item is ParsedContent & { frontmatter: FragmentContent } => item.frontmatter.type === 'fragment';

const isOtherEntry = (item: ParsedContent): item is ParsedContent & { frontmatter: SignalContent | Meta } => item.frontmatter.type === 'signal' || item.frontmatter.type === 'meta';

export async function load() {
	const artifacts = await getArtifactsContent();

	const filtered = artifacts.filter((item) => item.frontmatter.slug !== 'llms');
	const studies: HomeStudyArtifactRow[] = filtered.filter(isStudyEntry).map((item) => {
		return {
			slug: item.frontmatter.slug,
			title: item.frontmatter.title,
			description: item.frontmatter.description,
			type: 'study',
			date: item.frontmatter.date,
			client: item.frontmatter.client,
			mode: item.frontmatter.mode,
			thumbnails: collectStudyThumbnails(item),
			isConfidential: item.frontmatter.isConfidential ?? false,
		};
	});

	const fragments: HomeWritingArtifactRow[] = filtered.filter(isFragmentEntry).map((item) => ({
		slug: item.frontmatter.slug,
		title: item.frontmatter.title,
		description: item.frontmatter.description,
		type: 'fragment',
		date: item.frontmatter.date,
		excerpt: item.frontmatter.excerpt,
		isConfidential: false,
	}));

	const other: HomeOtherArtifactRow[] = filtered.filter(isOtherEntry).map((item) => ({
		slug: item.frontmatter.slug,
		title: item.frontmatter.title,
		description: item.frontmatter.description,
		type: item.frontmatter.type,
		date: item.frontmatter.date,
		isConfidential: false,
	}));

	return {
		seo: buildHomeSeo(),
		artifacts: {
			studies,
			fragments,
			other,
		} satisfies HomeArtifactGroups,
	};
}
