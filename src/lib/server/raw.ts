import { SITE } from '$lib/constants';
import { isStudy } from '$lib/content-types';
import { estimateMarkdownTokens } from '$lib/server/agent-policy';
import { formatArtifactsAsMarkdown, getContentBySlug, getDisplayableArtifacts, injectArtifactsIntoLlms, toMarkdown } from '$lib/server/content';
import { createErrorResponse, ForbiddenError, NotFoundError, ProcessingError, ValidationError } from '$lib/server/errors';
import { logEvent } from '$lib/server/logger';
import { validateSlug } from '$lib/server/validators';

export async function handleRawContentRequest(format: string, rawSlug: string): Promise<Response> {
	if (format !== 'md' && format !== 'txt') {
		return createErrorResponse(new ValidationError(`Invalid format: ${format}`), {
			format: 'json',
		});
	}

	const slugWithoutExt = rawSlug.replace(/\.(md|txt)$/, '');

	let slug: string;
	try {
		slug = validateSlug(slugWithoutExt);
	} catch (error) {
		return createErrorResponse(error as Error, { format: 'json' });
	}

	const content = await getContentBySlug(slug);
	if (!content) {
		logEvent('RAW', 'SERVE', 'NOT_FOUND', { slug, format });
		return createErrorResponse(new NotFoundError(`Content with slug '${slug}'`), {
			format: 'json',
		});
	}

	if (isStudy(content.frontmatter) && (content.frontmatter.isConfidential ?? false)) {
		logEvent('RAW', 'SERVE', 'FORBIDDEN', { slug, format, reason: 'confidential' });
		return createErrorResponse(new ForbiddenError(`Content with slug '${slug}'`, 'confidential content not accessible via API'), { format: 'json' });
	}

	try {
		let output = toMarkdown(content.frontmatter, content.content);

		if (slug === 'llms') {
			const artifacts = await getDisplayableArtifacts();
			const artifactsMarkdown = formatArtifactsAsMarkdown(artifacts);
			output = injectArtifactsIntoLlms(output, artifactsMarkdown);

			logEvent('RAW', 'INJECT_LLMS_ARTIFACTS', 'SUCCESS', {
				artifactCount: artifacts.length,
			});
		}

		output += `\n\n---\n\nFull sitemap: ${SITE.url}/sitemap.xml\n`;

		const contentType = format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8';

		const byteLength = new TextEncoder().encode(output).length;
		const response = new Response(output, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': `inline; filename="${slug}.${format}"`,
				'Content-Length': String(byteLength),
				'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
				'X-Robots-Tag': 'noindex, nofollow',
				'X-Content-Type-Options': 'nosniff',
				Link: `</${slug}>; rel="canonical"`,
				...(format === 'md' ? { 'X-Markdown-Tokens': String(estimateMarkdownTokens(output)) } : {}),
			},
		});

		logEvent('RAW', 'SERVE', 'SUCCESS', { slug, format, size: output.length });

		return response;
	} catch (error) {
		const processingError = new ProcessingError('Failed to transform MDX content to raw format', error instanceof Error ? { message: error.message } : undefined);

		return createErrorResponse(processingError, { format: 'json' });
	}
}
