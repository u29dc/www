import { error, redirect } from '@sveltejs/kit';
import { isStudy } from '$lib/content-types';
import { ValidationError } from '$lib/errors';
import { getAllContent, getContentBySlug, renderContentHtml } from '$lib/server/content';
import { validateSlug } from '$lib/server/validators';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const entries = async () => {
	const content = await getAllContent();
	return content
		.filter((item) => item.frontmatter.slug !== 'llms')
		.filter((item) => item.frontmatter.isArtifactItem !== false)
		.filter((item) => !(isStudy(item.frontmatter) && (item.frontmatter.isConfidential ?? false)))
		.map((item) => ({ slug: item.frontmatter.slug }));
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

	const entry = await getContentBySlug(slug);
	if (!entry) {
		throw error(404, 'Not Found');
	}

	if (isStudy(entry.frontmatter) && (entry.frontmatter.isConfidential ?? false)) {
		throw redirect(302, '/');
	}

	if (entry.frontmatter.isArtifactItem === false) {
		throw error(404, 'Not Found');
	}

	let contentHtml: string;
	try {
		contentHtml = renderContentHtml(entry.content);
	} catch {
		throw error(500, 'Failed to render content');
	}

	return {
		slug,
		frontmatter: entry.frontmatter,
		contentHtml,
	};
};
