import { error, redirect } from '@sveltejs/kit';
import { ValidationError } from '$lib/errors';
import { getPublicArtifactBySlug, getPublicArtifacts } from '$lib/server/artifacts';
import { extractFirstMedia, renderContentHtml, toMarkdownBody } from '$lib/server/content';
import { buildArtifactSeo } from '$lib/server/seo';
import { validateSlug } from '$lib/server/validators';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const entries = async () => {
	const artifacts = await getPublicArtifacts();
	return artifacts.map((item) => ({ slug: item.frontmatter.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
	let slug: string;
	try {
		slug = validateSlug(params.slug);
	} catch (err) {
		if (err instanceof ValidationError) {
			throw error(404, 'Not Found');
		}
		throw err;
	}

	if (slug === 'llms') {
		throw redirect(302, '/llms.txt');
	}

	const entry = await getPublicArtifactBySlug(slug);
	if (!entry) {
		throw error(404, 'Not Found');
	}

	const { firstMedia, remainingContent } = extractFirstMedia(entry.content);

	let contentHtml: string;
	try {
		contentHtml = renderContentHtml(remainingContent);
	} catch {
		throw error(500, 'Failed to render content');
	}

	return {
		slug,
		frontmatter: entry.frontmatter,
		firstMedia,
		articleContent: toMarkdownBody(entry.frontmatter, remainingContent, { stripMedia: true }),
		contentHtml,
		seo: buildArtifactSeo({
			slug,
			title: entry.frontmatter.title,
			description: entry.frontmatter.description,
			...(entry.frontmatter.ogImageAlt ? { ogImageAlt: entry.frontmatter.ogImageAlt } : {}),
		}),
	};
};
