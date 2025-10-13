/**
 * MDX Aggregator
 *
 * ## SUMMARY
 * Aggregates and manages collections of MDX content files.
 * Provides functions to retrieve all content or individual items by slug.
 *
 * ## RESPONSIBILITIES
 * - Scan content directory for MDX files
 * - Parse all MDX files in parallel for performance
 * - Sort content chronologically (newest first)
 * - Retrieve individual content items by slug
 * - Handle errors gracefully with null returns
 * - Log aggregation events for observability
 *
 * ## USAGE
 * ```typescript
 * import { getAllContent, getContentBySlug } from '@/lib/mdx/aggregator';
 *
 * // Get all content items sorted by date
 * const allContent = await getAllContent();
 *
 * // Get specific content by slug
 * const item = await getContentBySlug('battersea');
 * if (item) {
 *   console.log(item.frontmatter.title);
 * }
 * ```
 *
 * ## KEY FLOWS
 * ### getAllContent()
 * 1. Read content directory using fs.promises.readdir
 * 2. Filter for .mdx files only
 * 3. Parse all files in parallel using Promise.all
 * 4. Sort by date descending (newest first)
 * 5. Log collection stats
 *
 * ### getContentBySlug()
 * 1. Construct file path from slug
 * 2. Attempt to parse MDX file
 * 3. Return parsed content or null if not found
 * 4. Log retrieval result
 *
 * @module lib/mdx/aggregator
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseMDX } from '@/lib/mdx/processor';
import type { ParsedContent } from '@/lib/types/content';
import { logEvent } from '@/lib/utils/logger';

/**
 * Retrieves all MDX content files sorted by date
 *
 * Scans the content directory, parses all MDX files in parallel,
 * and returns them sorted chronologically (newest first).
 *
 * @returns Promise resolving to array of ParsedContent sorted by date descending
 * @throws Error if content directory cannot be read (propagated from fs.readdir)
 *
 * @example
 * ```typescript
 * const content = await getAllContent();
 * content.forEach(item => {
 *   console.log(`${item.frontmatter.title} - ${item.frontmatter.date}`);
 * });
 * ```
 */
export async function getAllContent(): Promise<ParsedContent[]> {
	// Resolve content directory path
	const contentDir = path.join(process.cwd(), 'src/content');

	// Read all files in content directory
	const files = await fs.readdir(contentDir);

	// Filter for MDX files only
	const mdxFiles = files.filter((file) => file.endsWith('.mdx'));

	// Parse all MDX files in parallel
	const content = await Promise.all(
		mdxFiles.map(async (file) => {
			const filePath = path.join(contentDir, file);
			return parseMDX(filePath);
		}),
	);

	// Sort by date descending (newest first)
	const sorted = content.sort((a, b) => {
		const dateA = new Date(a.frontmatter.date).getTime();
		const dateB = new Date(b.frontmatter.date).getTime();
		return dateB - dateA;
	});

	// Log collection stats
	logEvent('MDX', 'AGGREGATE', 'SUCCESS', {
		count: sorted.length,
		files: mdxFiles,
	});

	return sorted;
}

/**
 * Get all feed-visible content sorted by date (newest first)
 *
 * Filters content based on isFeedItem flag. Only returns content
 * where isFeedItem === true.
 *
 * @returns Promise resolving to array of ParsedContent sorted by date descending
 * @throws Error if content directory cannot be read (propagated from getAllContent)
 *
 * @example
 * ```typescript
 * const feedContent = await getFeedContent();
 * feedContent.forEach(item => {
 *   console.log(`${item.frontmatter.title} - ${item.frontmatter.date}`);
 * });
 * ```
 */
export async function getFeedContent(): Promise<ParsedContent[]> {
	const allContent = await getAllContent();
	return allContent.filter((item) => item.frontmatter.isFeedItem === true);
}

/**
 * Retrieves a single MDX content item by slug
 *
 * Constructs the file path from the slug and attempts to parse the MDX file.
 * Returns null if the file doesn't exist or parsing fails.
 *
 * @param slug - Content slug matching the filename without extension
 * @returns Promise resolving to ParsedContent or null if not found
 *
 * @example
 * ```typescript
 * const content = await getContentBySlug('battersea');
 * if (content) {
 *   console.log(content.frontmatter.title);
 * } else {
 *   console.log('Content not found');
 * }
 * ```
 */
export async function getContentBySlug(slug: string): Promise<ParsedContent | null> {
	try {
		// Resolve content directory and file path
		const contentDir = path.join(process.cwd(), 'src/content');
		const filePath = path.join(contentDir, `${slug}.mdx`);

		// Attempt to parse the MDX file
		const result = await parseMDX(filePath);

		// Log successful retrieval
		logEvent('MDX', 'GET_BY_SLUG', 'SUCCESS', { slug });

		return result;
	} catch {
		// Log failure (file not found or parse error)
		logEvent('MDX', 'GET_BY_SLUG', 'FAIL', { slug });

		// Return null instead of throwing
		return null;
	}
}
