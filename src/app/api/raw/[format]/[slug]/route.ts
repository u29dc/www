/**
 * Universal Raw Content API Endpoint
 *
 * ## SUMMARY
 * Serves MDX content in both markdown (.md) and plain text (.txt) formats.
 * Special handling for llms requests: injects complete sitemap at end of content.
 * Provides format-agnostic access to content via URL rewrites.
 *
 * ## RESPONSIBILITIES
 * - Detect format from route segment (md or txt)
 * - Retrieve and transform content to markdown format
 * - Inject sitemap XML into llms.md and llms.txt (only)
 * - Set appropriate content-type headers based on format
 * - Handle errors with structured responses
 * - Log all requests for monitoring and analytics
 * - Apply security headers and caching policies
 *
 * ## USAGE
 * Accessed via URL rewrites configured in next.config.ts:
 * - /slug.md → /api/raw/md/slug
 * - /slug.txt → /api/raw/txt/slug
 *
 * ## KEY FLOWS
 * 1. Request arrives with format and slug route segments
 * 2. Validate format is either 'md' or 'txt'
 * 3. Strip format extension from slug if present
 * 4. Validate and sanitize slug for security
 * 5. Retrieve content from aggregator via getContentBySlug()
 * 6. Transform content to markdown using toMarkdown()
 * 7. IF slug === 'llms': inject sitemap XML at end
 * 8. Set headers based on detected format
 * 9. Return response with appropriate content-type
 *
 * @module app/api/raw/[format]/[slug]/route
 */

import type { NextRequest } from 'next/server';
import { getContentBySlug } from '@/lib/mdx/aggregator';
import { toMarkdown } from '@/lib/mdx/processor';
import {
	createErrorResponse,
	NotFoundError,
	ProcessingError,
	ValidationError,
} from '@/lib/utils/errors';
import { logEvent } from '@/lib/utils/logger';
import { SITE } from '@/lib/utils/metadata';
import { generateSitemapEntries, generateSitemapXML } from '@/lib/utils/sitemap';
import { validateSlug } from '@/lib/utils/validators';

/**
 * Route segment configuration
 *
 * Route is dynamic to handle format route segment from rewrites.
 * Edge caching is controlled via Cache-Control response headers.
 * Expensive operations (MDX parsing) are cached in aggregator layer.
 */

/**
 * GET handler for raw content responses in multiple formats
 *
 * Handles requests to /slug.md and /slug.txt URLs by retrieving
 * MDX content, transforming it to plain markdown, optionally injecting sitemap
 * (for llms content only), and returning it with appropriate HTTP headers
 * based on the requested format.
 *
 * Format detection:
 * - Reads format from route segment (passed via rewrite)
 * - format='txt' → text/plain
 * - format='md' → text/markdown
 * - Other values → 400 Bad Request
 *
 * Special handling:
 * - For slug === 'llms' (BOTH .md and .txt formats): appends sitemap XML
 * - For other slugs: returns content without modification
 *
 * @param request - Next.js request object for URL inspection
 * @param context - Route context containing dynamic params (format and slug)
 * @returns Response object with formatted content or error message
 *
 * @example
 * ```typescript
 * // GET /llms.txt → Rewrites to /api/raw/txt/llms → Returns text format with sitemap
 * // GET /llms.md → Rewrites to /api/raw/md/llms → Returns markdown format with sitemap
 * // GET /patterns.md → Rewrites to /api/raw/md/patterns → Returns markdown without sitemap
 * // GET /invalid-slug.md → Returns 400 Bad Request
 * // GET /nonexistent.txt → Returns 404 Not Found
 * ```
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ format: string; slug: string }> },
) {
	const { format: rawFormat, slug: rawSlug } = await params;

	// Validate format is either 'md' or 'txt'
	if (rawFormat !== 'md' && rawFormat !== 'txt') {
		return createErrorResponse(new ValidationError(`Invalid format: ${rawFormat}`), {
			format: 'json',
		});
	}
	const format = rawFormat as 'md' | 'txt';

	// Remove extension from slug if present
	const slugWithoutExt = rawSlug.replace(/\.(md|txt)$/, '');

	// Validate slug (security)
	let slug: string;
	try {
		slug = validateSlug(slugWithoutExt);
	} catch (error) {
		// Return structured JSON error for validation failures
		return createErrorResponse(error as Error, { format: 'json' });
	}

	// Retrieve MDX content
	const content = await getContentBySlug(slug);
	if (!content) {
		logEvent('RAW', 'SERVE', 'NOT_FOUND', { slug, format });
		return createErrorResponse(new NotFoundError(`Content with slug '${slug}'`), {
			format: 'json',
		});
	}

	try {
		// Transform to markdown
		let output = toMarkdown(content.frontmatter, content.content);

		// CRITICAL: Inject sitemap into BOTH llms.md AND llms.txt
		// Check slug === 'llms' regardless of format
		if (slug === 'llms') {
			const sitemapEntries = await generateSitemapEntries(SITE.url);
			const sitemapXML = generateSitemapXML(sitemapEntries);

			// Append sitemap to llms content (both formats)
			output += `\n\n---\n\n## Sitemap\n\n\`\`\`xml\n${sitemapXML}\n\`\`\`\n`;

			logEvent('RAW', 'SITEMAP', 'INJECTED', {
				slug,
				format,
				sitemapEntries: sitemapEntries.length,
			});
		}

		// Set content-type based on format
		const contentType =
			format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8';

		// Construct response with appropriate headers
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
		// Return structured JSON error for processing failures
		const processingError = new ProcessingError(
			'Failed to transform MDX content to raw format',
			error instanceof Error ? { message: error.message } : undefined,
		);

		return createErrorResponse(processingError, { format: 'json' });
	}
}
