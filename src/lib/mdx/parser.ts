/**
 * MDX Parser
 *
 * ## SUMMARY
 * Parses individual MDX files with frontmatter validation and content extraction.
 * Provides runtime validation using Zod schemas and structured error handling.
 *
 * ## RESPONSIBILITIES
 * - Read MDX files from filesystem
 * - Extract and parse frontmatter using gray-matter
 * - Validate frontmatter against Zod schemas
 * - Return structured ParsedContent with validated data
 * - Handle file system errors with proper error classes
 * - Log parsing events for observability
 *
 * ## USAGE
 * ```typescript
 * import { parseMDX } from '@/lib/mdx/parser';
 *
 * // Parse a single MDX file
 * const content = await parseMDX('/path/to/file.mdx');
 * console.log(content.frontmatter.title);
 * console.log(content.content); // Raw markdown body
 * ```
 *
 * ## KEY FLOWS
 * 1. Read file from filesystem using fs.promises.readFile
 * 2. Parse frontmatter and content using gray-matter
 * 3. Validate frontmatter against ContentSchema (Zod)
 * 4. Return ParsedContent object with validated frontmatter
 * 5. Throw NotFoundError if file doesn't exist
 * 6. Log all parsing events for debugging
 *
 * @module lib/mdx/parser
 */

import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { NotFoundError } from '@/lib/errors/classes';
import type { ParsedContent } from '@/lib/types/content';
import { ContentSchema } from '@/lib/types/content';
import { logEvent } from '@/lib/utils/logger';

/**
 * Parses an MDX file and validates its frontmatter
 *
 * Reads the file from the filesystem, extracts frontmatter using gray-matter,
 * validates it against the ContentSchema, and returns a ParsedContent object.
 *
 * @param filePath - Absolute path to the MDX file
 * @returns Promise resolving to ParsedContent with validated frontmatter and content
 * @throws NotFoundError if the file doesn't exist or cannot be read
 * @throws ZodError if frontmatter validation fails (wrapped in NotFoundError)
 *
 * @example
 * ```typescript
 * const content = await parseMDX('/path/to/study.mdx');
 * if (content.frontmatter.type === 'study') {
 *   console.log(content.frontmatter.client);
 * }
 * ```
 */
export async function parseMDX(filePath: string): Promise<ParsedContent> {
	try {
		// Read file from filesystem
		const source = await fs.readFile(filePath, 'utf8');

		// Parse frontmatter and content
		const { data, content } = matter(source);

		// Normalize date field if it's a Date object (gray-matter auto-converts dates)
		// biome-ignore lint/complexity/useLiteralKeys: Bracket notation required by TypeScript strict mode (noPropertyAccessFromIndexSignature)
		if (data['date'] instanceof Date) {
			// biome-ignore lint/complexity/useLiteralKeys: Bracket notation required by TypeScript strict mode
			data['date'] = data['date'].toISOString();
		}

		// Validate frontmatter with Zod schema
		const frontmatter = ContentSchema.parse(data);

		// Log successful parse
		logEvent('MDX', 'PARSE', 'SUCCESS', {
			filePath,
			type: frontmatter.type,
			slug: frontmatter.slug,
		});

		return { frontmatter, content };
	} catch (error) {
		// Log failure with error details
		logEvent('MDX', 'PARSE', 'FAIL', {
			filePath,
			error: error instanceof Error ? error.message : String(error),
		});

		// Throw structured error
		throw new NotFoundError(`MDX file at ${filePath}`);
	}
}
