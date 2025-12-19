import { error, redirect } from '@sveltejs/kit';
import { isStudy } from '$lib/content-types';
import { ValidationError } from '$lib/errors';
import { getMdxEntry } from '$lib/server/mdx-modules';
import { validateSlug } from '$lib/server/validators';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
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

	const entry = getMdxEntry(slug);
	if (!entry) {
		throw error(404, 'Not Found');
	}

	if (isStudy(entry.frontmatter) && (entry.frontmatter.isConfidential ?? false)) {
		throw redirect(302, '/');
	}

	if (entry.frontmatter.isArtifactItem === false) {
		throw error(404, 'Not Found');
	}

	return {
		slug,
		frontmatter: entry.frontmatter,
	};
};
