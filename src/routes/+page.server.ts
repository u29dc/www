import { isStudy } from '$lib/content-types';
import { extractMediaFromContent, getMediaType, sanitizeMediaFilename } from '$lib/mdx-client';
import { getArtifactsContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const content = await getArtifactsContent();
	const artifacts = content.map((item) => {
		const rawThumbnail = item.frontmatter.thumbnailMedia ?? null;
		const safeThumbnail = rawThumbnail ? sanitizeMediaFilename(rawThumbnail) : null;
		const isThumbnailImage = safeThumbnail ? getMediaType(safeThumbnail) === 'image' : false;

		const mediaItems = extractMediaFromContent(item.content).filter((entry) => entry.type === 'image');
		const orderedMediaItems = isThumbnailImage
			? [...mediaItems.filter((entry) => entry.filename === safeThumbnail), ...mediaItems.filter((entry) => entry.filename !== safeThumbnail)]
			: mediaItems;

		return {
			item,
			isConfidential: isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false),
			mediaItems: orderedMediaItems,
		};
	});

	return { artifacts };
};
