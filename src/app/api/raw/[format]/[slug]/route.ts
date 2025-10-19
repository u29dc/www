/**
 * Universal Raw Content API Endpoint
 *
 * ## SUMMARY
 * Serves MDX content in markdown (.md) and plain text (.txt) formats via URL rewrites.
 *
 * ## RESPONSIBILITIES
 * - Validate format and slug, transform content to markdown with sitemap footer
 * - Set appropriate headers, caching policies, and error responses
 *
 * ## KEY FLOWS
 * 1. Validate format (md/txt) and sanitize slug for security
 * 2. Retrieve content, transform to markdown, append sitemap reference
 * 3. Return response with format-specific content-type and security headers
 *
 * @module app/api/raw/[format]/[slug]/route
 */

import type { NextRequest } from 'next/server';
import { SITE } from '@/lib/constants';
import { createErrorResponse, NotFoundError, ProcessingError, ValidationError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { getContentBySlug, toMarkdown } from '@/lib/mdx-server';
import { validateSlug } from '@/lib/validators';

/**
 * GET handler for raw content in md/txt formats.
 * @param _request - Next.js request object
 * @param context - Route context with format and slug params
 * @returns Response with formatted content or error
 * @throws {ValidationError} If format/slug invalid
 * @throws {NotFoundError} If content not found
 * @throws {ProcessingError} If transformation fails
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ format: string; slug: string }> },
) {
	const { format: rawFormat, slug: rawSlug } = await params;

	if (rawFormat !== 'md' && rawFormat !== 'txt') {
		return createErrorResponse(new ValidationError(`Invalid format: ${rawFormat}`), {
			format: 'json',
		});
	}
	const format = rawFormat as 'md' | 'txt';

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

	try {
		let output = toMarkdown(content.frontmatter, content.content);
		output += `\n\n---\n\nFull sitemap: ${SITE.url}/sitemap.xml\n`;

		const contentType =
			format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8';

		const response = new Response(output, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': `inline; filename="${slug}.${format}"`,
				'Content-Length': String(Buffer.byteLength(output, 'utf-8')),
				'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
				'X-Robots-Tag': 'noindex, nofollow',
				'X-Content-Type-Options': 'nosniff',
				Link: `</${slug}>; rel="canonical"`,
			},
		});

		logEvent('RAW', 'SERVE', 'SUCCESS', { slug, format, size: output.length });

		return response;
	} catch (error) {
		const processingError = new ProcessingError(
			'Failed to transform MDX content to raw format',
			error instanceof Error ? { message: error.message } : undefined,
		);

		return createErrorResponse(processingError, { format: 'json' });
	}
}
