import { extractMediaFromContent, getArtifactsContent } from '$lib/server/content';
import { buildHomeSeo } from '$lib/server/seo';

export async function load() {
	const artifacts = await getArtifactsContent();

	const filtered = artifacts.filter((item) => item.frontmatter.slug !== 'llms');

	return {
		seo: buildHomeSeo(),
		artifacts: filtered.map((item) => ({
			slug: item.frontmatter.slug,
			title: item.frontmatter.title,
			description: item.frontmatter.description,
			type: item.frontmatter.type,
			date: item.frontmatter.date,
			media: extractMediaFromContent(item.content),
			isConfidential: item.frontmatter.type === 'study' && 'isConfidential' in item.frontmatter ? (item.frontmatter.isConfidential ?? false) : false,
		})),
	};
}
