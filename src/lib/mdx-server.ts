/**
 * MDX Processing and Content Management (Server-Only)
 *
 * ## SUMMARY
 * Server-only MDX module for content types, aggregation, and transformation.
 *
 * ## RESPONSIBILITIES
 * - Define Zod schemas and TypeScript types for content
 * - Aggregate and parse MDX content files with validation
 * - Transform MDX to plain markdown for .md endpoints
 *
 * @module lib/mdx-server
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { z } from 'zod';
import { NotFoundError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { CDN, sanitizeMediaFilename } from '@/lib/mdx-client';

// ==================================================
// TYPE DEFINITIONS AND SCHEMAS
// ==================================================

export const StudySchema = z.object({
	type: z.literal('study'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	client: z.string().min(1),
	role: z.string().min(1),
	year: z.number().int().min(2000).max(2100),
	mode: z.enum(['LAB', 'COM']),
	image: z.string().optional(),
	featured: z.boolean().optional(),
	isFeedItem: z.boolean(),
});

export const FragmentSchema = z.object({
	type: z.literal('fragment'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	excerpt: z.string().optional(),
	image: z.string().optional(),
	isFeedItem: z.boolean(),
});

export const SignalSchema = z.object({
	type: z.literal('signal'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	source: z.string().optional(),
	link: z.url().optional(),
	image: z.string().optional(),
	isFeedItem: z.boolean(),
});

export const MetaSchema = z.object({
	type: z.literal('meta'),
	date: z.iso.datetime(),
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().min(1),
	isFeedItem: z.boolean(),
	image: z.string().optional(),
});

export const ContentSchema = z.discriminatedUnion('type', [
	StudySchema,
	FragmentSchema,
	SignalSchema,
	MetaSchema,
]);

export type StudyContent = z.infer<typeof StudySchema>;
export type FragmentContent = z.infer<typeof FragmentSchema>;
export type SignalContent = z.infer<typeof SignalSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type ContentItem = z.infer<typeof ContentSchema>;

export interface ParsedContent {
	frontmatter: ContentItem;
	content: string;
}

// Re-export client types for convenience
export type { MediaItem } from '@/lib/mdx-client';

// ==================================================
// TYPE GUARDS
// ==================================================

export function isStudy(item: ContentItem): item is StudyContent {
	return item.type === 'study';
}

export function isFragment(item: ContentItem): item is FragmentContent {
	return item.type === 'fragment';
}

export function isSignal(item: ContentItem): item is SignalContent {
	return item.type === 'signal';
}

export function isMeta(item: ContentItem): item is Meta {
	return item.type === 'meta';
}

// ==================================================
// CONTENT AGGREGATION
// ==================================================

async function getAllContentImpl(): Promise<ParsedContent[]> {
	const contentDir = path.join(process.cwd(), 'src/content');

	const files = await fs.readdir(contentDir);

	const mdxFiles = files.filter((file) => file.endsWith('.mdx'));

	const content = await Promise.all(
		mdxFiles.map(async (file) => {
			const filePath = path.join(contentDir, file);
			return parseMDX(filePath);
		}),
	);

	const sorted = content.sort((a, b) => {
		const dateA = new Date(a.frontmatter.date).getTime();
		const dateB = new Date(b.frontmatter.date).getTime();
		return dateB - dateA;
	});

	logEvent('MDX', 'AGGREGATE', 'SUCCESS', {
		count: sorted.length,
		files: mdxFiles,
	});

	return sorted;
}

/**
 * Retrieves all MDX content files sorted by date (cached).
 * @returns Parsed content sorted by date descending
 */
export const getAllContent = cache(
	unstable_cache(getAllContentImpl, ['content-all'], {
		tags: ['content:all'],
	}),
);

async function getFeedContentImpl(): Promise<ParsedContent[]> {
	const allContent = await getAllContent();
	return allContent.filter((item) => item.frontmatter.isFeedItem === true);
}

/**
 * Get all feed-visible content sorted by date (cached).
 * @returns Feed content sorted by date descending
 */
export const getFeedContent = cache(
	unstable_cache(getFeedContentImpl, ['content-feed'], {
		tags: ['content:feed', 'content:all'],
	}),
);

async function getContentBySlugImpl(slug: string): Promise<ParsedContent | null> {
	try {
		const contentDir = path.join(process.cwd(), 'src/content');
		const filePath = path.join(contentDir, `${slug}.mdx`);

		const result = await parseMDX(filePath);

		logEvent('MDX', 'GET_BY_SLUG', 'SUCCESS', { slug });

		return result;
	} catch {
		logEvent('MDX', 'GET_BY_SLUG', 'FAIL', { slug });

		return null;
	}
}

/**
 * Retrieves a single MDX content item by slug (cached).
 * @param slug - Content slug
 * @returns Parsed content or null
 */
export const getContentBySlug = cache((slug: string) => {
	return unstable_cache(async () => getContentBySlugImpl(slug), [`content-slug-${slug}`], {
		tags: ['content:all', `content:${slug}`],
	})();
});

// ==================================================
// MDX PARSING
// ==================================================

/**
 * Parses an MDX file and validates its frontmatter.
 * @param filePath - Absolute path to MDX file
 * @returns Parsed content with validated frontmatter
 * @throws {NotFoundError} If file not found or validation fails
 */
export async function parseMDX(filePath: string): Promise<ParsedContent> {
	try {
		const source = await fs.readFile(filePath, 'utf8');

		const { data, content } = matter(source);

		// biome-ignore lint/complexity/useLiteralKeys: Bracket notation required by TypeScript strict mode (noPropertyAccessFromIndexSignature)
		if (data['date'] instanceof Date) {
			// biome-ignore lint/complexity/useLiteralKeys: Bracket notation required by TypeScript strict mode
			data['date'] = data['date'].toISOString();
		}

		const frontmatter = ContentSchema.parse(data);

		logEvent('MDX', 'PARSE', 'SUCCESS', {
			filePath,
			type: frontmatter.type,
			slug: frontmatter.slug,
		});

		return { frontmatter, content };
	} catch (error) {
		logEvent('MDX', 'PARSE', 'FAIL', {
			filePath,
			error: error instanceof Error ? error.message : String(error),
		});

		throw new NotFoundError(`MDX file at ${filePath}`);
	}
}

// ==================================================
// MARKDOWN TRANSFORMATION
// ==================================================

/**
 * Transforms MDX content to plain markdown.
 * @param frontmatter - Validated frontmatter
 * @param content - Raw MDX content
 * @returns Plain markdown with YAML frontmatter
 */
export function toMarkdown(frontmatter: ContentItem, content: string): string {
	const startTime = performance.now();

	let markdown = content;

	markdown = markdown.replace(/<MdxParagraph>\s*/g, '');
	markdown = markdown.replace(/\s*<\/MdxParagraph>/g, '');

	markdown = markdown.replace(/<MdxMedia\s+src=\{(\[[^\]]*\])\}\s*\/>/g, (match, srcArray) => {
		try {
			const normalizedArray = srcArray.replace(/'/g, '"');
			const parsed = JSON.parse(normalizedArray);

			if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
				logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'INVALID_ARRAY', { match });
				return '\n\n<!-- Media gallery (invalid format) -->\n\n';
			}

			const sources: string[] = parsed;

			const mediaItems = sources
				.map((src: string) => {
					const sanitized = sanitizeMediaFilename(src);
					if (!sanitized) {
						return null;
					}

					const url = `${CDN.mediaUrl}${sanitized}`;
					return `![${sanitized}](${url})`;
				})
				.filter((item): item is string => item !== null)
				.join('\n\n');

			if (mediaItems.length === 0) {
				logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'NO_VALID_MEDIA', { match });
				return '\n\n<!-- Media gallery (no valid files) -->\n\n';
			}

			return `\n\n${mediaItems}\n\n`;
		} catch (error) {
			logEvent('MARKDOWN', 'EXTRACT_MEDIA', 'FAIL', { error, match });
			return '\n\n<!-- Media gallery (parsing error) -->\n\n';
		}
	});

	markdown = markdown.replace(/^import\s+.*$/gm, '');
	markdown = markdown.replace(/^export\s+.*$/gm, '');
	markdown = markdown.replace(/\n{3,}/g, '\n\n');
	markdown = markdown.trim();

	const yamlFrontmatter = yaml.dump(frontmatter, {
		lineWidth: -1,
		noRefs: true,
	});

	const result = `---\n${yamlFrontmatter}---\n\n${markdown}`;

	const duration = performance.now() - startTime;
	logEvent('MARKDOWN', 'TRANSFORM', 'SUCCESS', {
		duration: `${duration.toFixed(2)}ms`,
		size: result.length,
	});

	return result;
}
