/**
 * Markdown Response Route Handler
 *
 * ## SUMMARY
 * Serves raw markdown versions of MDX content at /{slug}.md URLs.
 *
 * ## RESPONSIBILITIES
 * - Validate slug for security (path traversal prevention)
 * - Retrieve MDX content via getContentBySlug()
 * - Transform MDX to markdown via toMarkdown()
 * - Set appropriate HTTP headers
 * - Return markdown response with caching
 *
 * ## USAGE
 * - /patterns → HTML rendering (page.tsx)
 * - /patterns.md → Markdown response (this handler)
 *
 * ## KEY FLOWS
 * 1. Extract slug from params
 * 2. Validate slug (security)
 * 3. Retrieve MDX content
 * 4. Transform to markdown
 * 5. Return response with headers
 *
 * @module app/[slug].md/route
 */

import type { NextRequest } from 'next/server';
import { getAllContent, getContentBySlug } from '@/lib/mdx/aggregator';
import { toMarkdown } from '@/lib/mdx/processor';
import { createErrorResponse, NotFoundError, ProcessingError } from '@/lib/utils/errors';
import { logEvent } from '@/lib/utils/logger';
import { validateSlug } from '@/lib/utils/validators';

/**
 * Route segment configuration
 *
 * Enables ISR with 24-hour revalidation and forces static generation
 * at build time for all valid content slugs.
 */
export const revalidate = 86400; // 24 hours
export const dynamic = 'force-static'; // Pre-generate at build time

/**
 * Generate static params for all content slugs
 *
 * Pre-generates markdown responses for all valid content at build time.
 * This ensures all /{slug}.md URLs are statically generated and cached.
 *
 * @returns Array of param objects containing slug values
 *
 * @example
 * ```typescript
 * // Returns: [{ slug: 'patterns' }, { slug: 'battersea' }, ...]
 * ```
 */
export async function generateStaticParams() {
	const allContent = await getAllContent();

	return allContent.map(({ frontmatter }) => ({
		slug: frontmatter.slug,
	}));
}

/**
 * GET handler for markdown responses
 *
 * Handles requests to /{slug}.md URLs by retrieving MDX content,
 * transforming it to plain markdown, and returning it with appropriate
 * HTTP headers for caching and security.
 *
 * @param request - Next.js request object (unused but required by signature)
 * @param context - Route context containing dynamic params
 * @returns Response object with markdown content or error message
 *
 * @example
 * ```typescript
 * // GET /patterns.md → Returns markdown version of patterns content
 * // GET /invalid-slug.md → Returns 400 Bad Request
 * // GET /nonexistent.md → Returns 404 Not Found
 * ```
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug: rawSlug } = await params;

	// Validate slug (security) - now throws ValidationError
	let slug: string;
	try {
		slug = validateSlug(rawSlug);
	} catch (error) {
		// Return structured JSON error for validation failures
		return createErrorResponse(error as Error, { format: 'json' });
	}

	// Retrieve MDX content
	const content = await getContentBySlug(slug);
	if (!content) {
		logEvent('MARKDOWN', 'SERVE', 'NOT_FOUND', { slug });
		return createErrorResponse(new NotFoundError(`Content with slug '${slug}'`), {
			format: 'json',
		});
	}

	try {
		// Transform to markdown
		const markdown = toMarkdown(content.frontmatter, content.content);

		// Construct response with appropriate headers
		const response = new Response(markdown, {
			status: 200,
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Content-Disposition': `inline; filename="${slug}.md"`,
				'Content-Length': String(Buffer.byteLength(markdown, 'utf-8')),
				'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
				'X-Robots-Tag': 'noindex, nofollow',
				'X-Content-Type-Options': 'nosniff',
				Link: `</${slug}>; rel="canonical"`,
			},
		});

		logEvent('MARKDOWN', 'SERVE', 'SUCCESS', { slug, size: markdown.length });

		return response;
	} catch (error) {
		// Return structured JSON error for processing failures
		const processingError = new ProcessingError(
			'Failed to transform MDX content to markdown',
			error instanceof Error ? { message: error.message } : undefined,
		);

		return createErrorResponse(processingError, { format: 'json' });
	}
}
