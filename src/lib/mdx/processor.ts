/**
 * MDX Processor
 *
 * ## SUMMARY
 * Unified MDX processing module for parsing files and transforming content.
 * Handles both filesystem operations (reading/validating) and content transformations
 * (MDX → React components via Next.js, MDX → plain markdown).
 *
 * ## RESPONSIBILITIES
 * - Read MDX files from filesystem with frontmatter extraction
 * - Validate frontmatter against Zod schemas
 * - Transform MDX content to plain markdown for .md endpoints
 * - Handle file system errors with proper error classes
 * - Log all processing events for observability
 *
 * ## USAGE
 * ```typescript
 * import { parseMDX, toMarkdown } from '@/lib/mdx/processor';
 *
 * // Parse MDX file from filesystem
 * const parsed = await parseMDX('/path/to/file.mdx');
 *
 * // Convert to plain markdown
 * const markdown = toMarkdown(parsed.frontmatter, parsed.content);
 * ```
 *
 * @module lib/mdx/processor
 */

import fs from 'node:fs/promises';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { ContentItem, ParsedContent } from '@/lib/types/content';
import { ContentSchema } from '@/lib/types/content';
import { NotFoundError } from '@/lib/utils/errors';
import { logEvent } from '@/lib/utils/logger';

/**
 * Allowed media file extensions for URL construction
 * Prevents serving arbitrary files from storage
 */
const ALLOWED_MEDIA_EXTENSIONS = ['.webp', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.mp4'];

/**
 * Safe filename pattern - alphanumeric, hyphens, underscores only
 * No path components (., /, \) to prevent traversal
 */
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/;

/**
 * Sanitizes media filename for URL construction
 *
 * Validates filename against security requirements:
 * - Must match safe pattern (alphanumeric + hyphens/underscores + extension)
 * - Must have allowed file extension
 * - No path traversal characters
 *
 * @param filename - Media filename from MDX content
 * @returns Sanitized filename if valid, null if invalid
 *
 * @example
 * ```typescript
 * sanitizeMediaFilename('L1Z1.webm')        // Returns: 'L1Z1.webm'
 * sanitizeMediaFilename('../../etc/passwd') // Returns: null (path traversal)
 * sanitizeMediaFilename('file.exe')         // Returns: null (invalid extension)
 * ```
 */
function sanitizeMediaFilename(filename: string): string | null {
	// Must match safe pattern (no path components)
	if (!SAFE_FILENAME_PATTERN.test(filename)) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'INVALID_PATTERN', {
			filename: filename.substring(0, 50),
		});
		return null;
	}

	// Must have allowed extension
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'NO_EXTENSION', { filename });
		return null;
	}

	const ext = filename.substring(lastDot).toLowerCase();
	if (!ALLOWED_MEDIA_EXTENSIONS.includes(ext)) {
		logEvent('MDX', 'SANITIZE_MEDIA', 'INVALID_EXTENSION', {
			filename,
			extension: ext,
			allowed: ALLOWED_MEDIA_EXTENSIONS,
		});
		return null;
	}

	return filename;
}

/**
 * Parses an MDX file and validates its frontmatter
 *
 * Reads the file from the filesystem, extracts frontmatter using gray-matter,
 * validates it against the ContentSchema, and returns a ParsedContent object.
 * The returned content is raw MDX that can be processed by Next.js or transformed
 * to plain markdown using toMarkdown().
 *
 * @param filePath - Absolute path to the MDX file
 * @returns Promise resolving to ParsedContent with validated frontmatter and raw MDX content
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

/**
 * Transforms MDX content to plain markdown
 *
 * Strips JSX components (MdxContent, MdxMedia), extracts media sources and converts
 * them to standard markdown images, removes import/export statements, and serializes
 * frontmatter to YAML. Returns a complete markdown document suitable for .md endpoints.
 *
 * @param frontmatter - Validated frontmatter object
 * @param content - Raw MDX content body
 * @returns Plain markdown string with YAML frontmatter
 *
 * @example
 * ```typescript
 * const parsed = await parseMDX('/path/to/file.mdx');
 * const markdown = toMarkdown(parsed.frontmatter, parsed.content);
 * // Returns: "---\ntitle: ...\n---\n\nContent..."
 * ```
 */
export function toMarkdown(frontmatter: ContentItem, content: string): string {
	const startTime = performance.now();

	let markdown = content;

	markdown = markdown.replace(/<MdxContent>\s*/g, '');
	markdown = markdown.replace(/\s*<\/MdxContent>/g, '');

	// Extract and convert MdxMedia array-based syntax to markdown images
	// Fixed regex: [^\]]* instead of .*? to prevent ReDoS (catastrophic backtracking)
	markdown = markdown.replace(/<MdxMedia\s+src=\{(\[[^\]]*\])\}\s*\/>/g, (match, srcArray) => {
		try {
			// Parse the array literal: ["file1.webm", "file2.webp"]
			// Handle both single and double quotes
			const normalizedArray = srcArray.replace(/'/g, '"');
			const parsed = JSON.parse(normalizedArray);

			// Validate parsed result is a string array
			if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
				logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'INVALID_ARRAY', { match });
				return '\n\n<!-- Media gallery (invalid format) -->\n\n';
			}

			const sources: string[] = parsed;

			// Generate markdown for each media file (with sanitization)
			const mediaItems = sources
				.map((src: string) => {
					// Sanitize filename to prevent path traversal and injection
					const sanitized = sanitizeMediaFilename(src);
					if (!sanitized) {
						// Invalid filename - skip this media item
						return null;
					}

					const url = `https://storage.u29dc.com/media/${sanitized}`;
					// Use consistent markdown image syntax (works for both images and videos)
					return `![Media](${url})`;
				})
				.filter((item): item is string => item !== null) // Remove nulls (invalid files)
				.join('\n\n');

			// Only render gallery if we have valid media items
			if (mediaItems.length === 0) {
				logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'NO_VALID_MEDIA', { match });
				return '\n\n<!-- Media gallery (no valid files) -->\n\n';
			}

			// Add section header
			return `\n\n## Media Gallery\n\n${mediaItems}\n\n`;
		} catch (error) {
			logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'FAIL', { error, match });
			return '\n\n<!-- Media gallery (parsing error) -->\n\n';
		}
	});

	markdown = markdown.replace(/^import\s+.*$/gm, '');
	markdown = markdown.replace(/^export\s+.*$/gm, '');
	markdown = markdown.replace(/\n{3,}/g, '\n\n');
	markdown = markdown.trim();

	// Serialize frontmatter to YAML
	const yamlFrontmatter = yaml.dump(frontmatter, {
		lineWidth: -1, // No line wrapping
		noRefs: true, // No YAML references
	});

	// Construct final markdown
	const result = `---\n${yamlFrontmatter}---\n\n${markdown}`;

	const duration = performance.now() - startTime;
	logEvent('MARKDOWN', 'TRANSFORM', 'SUCCESS', {
		duration: `${duration.toFixed(2)}ms`,
		size: result.length,
	});

	return result;
}
