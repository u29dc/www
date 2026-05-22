import type { APIRoute } from 'astro';
import { getArtifacts, type ArtifactEntry } from '../lib/content';
import { toArtifactMarkdown } from '../lib/markdown';

export async function getStaticPaths() {
	const artifacts = await getArtifacts();
	return artifacts
		.filter((entry) => !(entry.data.type === 'study' && entry.data.isConfidential))
		.map((entry) => ({
			params: { slug: entry.data.slug },
			props: { entry },
		}));
}

export const GET: APIRoute = ({ props }) => {
	const entry = props['entry'] as ArtifactEntry;

	return new Response(toArtifactMarkdown(entry), {
		headers: {
			'Cache-Control': 'public, max-age=0, must-revalidate',
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
