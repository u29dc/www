/**
 * Universal Raw Content API Endpoint
 *
 * ## SUMMARY
 * Serves MDX content in both markdown (.md) and plain text (.txt) formats.
 * Special handling for llms requests: injects complete sitemap at end of content.
 * Provides format-agnostic access to content via URL rewrites.
 *
 * ## RESPONSIBILITIES
 * - Detect format from URL path (.md vs .txt extension)
 * - Retrieve and transform content to markdown format
 * - Inject sitemap XML into llms.md and llms.txt (only)
 * - Set appropriate content-type headers based on format
 * - Handle errors with structured responses
 * - Log all requests for monitoring and analytics
 * - Apply security headers and caching policies
 *
 * ## USAGE
 * Accessed via URL rewrites configured in next.config.ts:
 * - /raw/slug.md → /api/raw/slug (markdown format)
 * - /raw/slug.txt → /api/raw/slug (text format)
 *
 * ## KEY FLOWS
 * 1. Request arrives with slug parameter
 * 2. Detect format from URL pathname (.md vs .txt)
 * 3. Strip format extension from slug if present
 * 4. Validate and sanitize slug for security
 * 5. Retrieve content from aggregator via getContentBySlug()
 * 6. Transform content to markdown using toMarkdown()
 * 7. IF slug === 'llms': inject sitemap XML at end
 * 8. Set headers based on detected format
 * 9. Return response with appropriate content-type
 *
 * @module app/api/raw/[slug]/route
 */

import type { NextRequest } from 'next/server';
import { getAllContent, getContentBySlug } from '@/lib/mdx/aggregator';
import { toMarkdown } from '@/lib/mdx/processor';
import { createErrorResponse, NotFoundError, ProcessingError } from '@/lib/utils/errors';
import { logEvent } from '@/lib/utils/logger';
import { SITE } from '@/lib/utils/metadata';
import { generateSitemapEntries, generateSitemapXML } from '@/lib/utils/sitemap';
import { validateSlug } from '@/lib/utils/validators';

/**
 * Route segment configuration
 *
 * Enables ISR with 24-hour revalidation and forces static generation
 * at build time for all valid content slugs in both formats (.md and .txt).
 */
export const revalidate = 86400; // 24 hours
export const dynamic = 'force-static'; // Pre-generate at build time

/**
 * Generate static params for all content slugs
 *
 * Pre-generates raw content responses for all valid content at build time.
 * This ensures all /raw/{slug}.md and /raw/{slug}.txt URLs are statically
 * generated and cached for optimal performance.
 *
 * @returns Array of param objects containing slug values
 *
 * @example
 * ```typescript
 * // Returns: [{ slug: 'llms' }, { slug: 'patterns' }, ...]
 * ```
 */
export async function generateStaticParams() {
	const allContent = await getAllContent();

	return allContent.map(({ frontmatter }) => ({
		slug: frontmatter.slug,
	}));
}

/**
 * GET handler for raw content responses in multiple formats
 *
 * Handles requests to /raw/{slug}.md and /raw/{slug}.txt URLs by retrieving
 * MDX content, transforming it to plain markdown, optionally injecting sitemap
 * (for llms content only), and returning it with appropriate HTTP headers
 * based on the requested format.
 *
 * Format detection:
 * - Checks URL pathname for .txt extension → text/plain
 * - Otherwise defaults to .md → text/markdown
 *
 * Special handling:
 * - For slug === 'llms' (BOTH .md and .txt formats): appends sitemap XML
 * - For other slugs: returns content without modification
 *
 * @param request - Next.js request object for URL inspection
 * @param context - Route context containing dynamic params
 * @returns Response object with formatted content or error message
 *
 * @example
 * ```typescript
 * // GET /raw/llms.txt → Returns text format with sitemap injected
 * // GET /raw/llms.md → Returns markdown format with sitemap injected
 * // GET /raw/patterns.md → Returns markdown without sitemap
 * // GET /raw/invalid-slug.md → Returns 400 Bad Request
 * // GET /raw/nonexistent.txt → Returns 404 Not Found
 * ```
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
	const { slug: rawSlug } = await params;

	// Detect format from URL path
	const url = new URL(request.url);
	const format = url.pathname.endsWith('.txt') ? 'txt' : 'md';

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
