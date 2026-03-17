import { isStudy, type ParsedContent } from '$lib/content-types';
import { getAllContent, getContentBySlug } from '$lib/server/content';

export function isPublicArtifact(entry: ParsedContent): boolean {
	if (entry.frontmatter.slug === 'llms') return false;
	if (entry.frontmatter.isArtifactItem === false) return false;
	if (isStudy(entry.frontmatter) && (entry.frontmatter.isConfidential ?? false)) {
		return false;
	}
	return true;
}

export async function getPublicArtifacts(): Promise<ParsedContent[]> {
	const content = await getAllContent();
	return content.filter(isPublicArtifact);
}

export async function getPublicArtifactBySlug(slug: string): Promise<ParsedContent | null> {
	const entry = await getContentBySlug(slug);
	if (!entry) return null;
	return isPublicArtifact(entry) ? entry : null;
}
