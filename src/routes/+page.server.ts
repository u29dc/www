import { isStudy } from '$lib/content-types';
import { extractMediaFromContent } from '$lib/mdx-client';
import { getArtifactsContent } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const content = await getArtifactsContent();
	const artifacts = content.map((item) => ({
		item,
		isConfidential: isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false),
		thumbnailUrl: item.frontmatter.thumbnailMedia ?? null,
		mediaItems: extractMediaFromContent(item.content),
	}));

	return { artifacts };
};
