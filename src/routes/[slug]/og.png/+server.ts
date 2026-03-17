import { error } from '@sveltejs/kit';
import { getPublicArtifactBySlug, getPublicArtifacts } from '$lib/server/artifacts';
import { renderOgCard } from '$lib/server/og';
import { validateSlug } from '$lib/server/validators';
import type { RequestHandler } from './$types';

export const prerender = true;

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
};

export const entries = async () => {
	const artifacts = await getPublicArtifacts();
	return artifacts.map((artifact) => ({ slug: artifact.frontmatter.slug }));
};

export const GET: RequestHandler = async ({ params }) => {
	let slug: string;
	try {
		slug = validateSlug(params.slug);
	} catch {
		throw error(404, 'Not Found');
	}

	const entry = await getPublicArtifactBySlug(slug);
	if (!entry) {
		throw error(404, 'Not Found');
	}

	const png = await renderOgCard({
		id: slug,
		title: entry.frontmatter.title,
		textTone: entry.frontmatter.ogTextTone ?? 'auto',
		...(entry.frontmatter.ogImage ? { source: entry.frontmatter.ogImage } : {}),
	});

	return new Response(toArrayBuffer(png), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
		},
	});
};
