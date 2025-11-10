/**
 * MDX Processing and Content Management (Server-Only)
 *
 * ## SUMMARY
 * Server-only MDX module for content types, aggregation, and transformation.
 *
 * ## RESPONSIBILITIES
 * - Aggregate and parse MDX content files with validation
 * - Transform MDX to plain markdown for .md endpoints
 * - Re-export shared types from mdx-types module
 *
 * @module lib/mdx-server
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { CDN } from '@/lib/constants';
import { NotFoundError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { type ContentItem, ContentSchema, isStudy, type ParsedContent } from '@/lib/mdx-types';

// ==================================================
// RE-EXPORTS (Client/Server Shared Types)
// ==================================================

// Re-export client types for convenience
export type { MediaItem } from '@/lib/mdx-client';
// Re-export all types and schemas from mdx-types for backward compatibility
export * from '@/lib/mdx-types';

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

async function getArtifactsContentImpl(): Promise<ParsedContent[]> {
	const allContent = await getAllContent();
	return allContent.filter((item) => item.frontmatter.isArtifactItem === true);
}

/**
 * Get all artifact-visible content sorted by date (cached).
 * @returns Artifacts content sorted by date descending
 */
export const getArtifactsContent = cache(
	unstable_cache(getArtifactsContentImpl, ['content-artifacts'], {
		tags: ['content:artifacts', 'content:all'],
	}),
);

async function getStudyArtifactsImpl(): Promise<ParsedContent[]> {
	const artifacts = await getArtifactsContent();
	return artifacts.filter(
		(item) => isStudy(item.frontmatter) && !(item.frontmatter.isConfidential ?? false),
	);
}

/**
 * Get all study artifacts (type=study, isArtifactItem=true, non-confidential).
 * Results are sorted by date descending (newest first).
 *
 * @returns Study content items
 */
export const getStudyArtifacts = cache(
	unstable_cache(getStudyArtifactsImpl, ['content-study-artifacts'], {
		tags: ['content:artifacts', 'content:all'],
	}),
);

/**
 * Format study artifacts as markdown section content.
 * Each study is converted to a ### heading with full MDX body content below.
 *
 * @param studies - Study content items (should be pre-filtered and sorted)
 * @param maxCount - Optional limit on number of studies to include
 * @returns Formatted markdown string ready for injection
 */
export function formatStudyArtifactsAsMarkdown(
	studies: ParsedContent[],
	maxCount?: number,
): string {
	if (studies.length === 0) {
		return '<!-- No study artifacts currently available -->\n';
	}

	// Apply optional limit
	const limitedStudies = maxCount ? studies.slice(0, maxCount) : studies;

	const sections = limitedStudies.map((study) => {
		const { title } = study.frontmatter;

		// Convert full MDX body to markdown (without frontmatter)
		const bodyMarkdown = toMarkdownBody(study.frontmatter, study.content, {
			stripMedia: true,
		});

		// Format as markdown section: ### Title\n\n{body}
		return `### ${title}\n\n${bodyMarkdown}`;
	});

	return sections.join('\n\n');
}

/**
 * Inject study artifacts into llms.mdx content at placeholder marker.
 * Searches for [ARTIFACTS] token and replaces with formatted artifacts markdown.
 *
 * @param llmsContent - Raw markdown content from llms.mdx
 * @param artifactsMarkdown - Formatted artifacts section content
 * @returns Content with artifacts injected, or original if placeholder not found
 */
export function injectArtifactsIntoLlms(llmsContent: string, artifactsMarkdown: string): string {
	const PLACEHOLDER = '[ARTIFACTS]';

	if (!llmsContent.includes(PLACEHOLDER)) {
		logEvent('MDX', 'INJECT_ARTIFACTS', 'PLACEHOLDER_MISSING', {
			contentLength: llmsContent.length,
		});
		return llmsContent;
	}

	const injected = llmsContent.replace(PLACEHOLDER, artifactsMarkdown);

	logEvent('MDX', 'INJECT_ARTIFACTS', 'SUCCESS', {
		studyCount: artifactsMarkdown.split('###').length - 1,
	});

	return injected;
}

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

		if (data['date'] instanceof Date) {
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

interface MarkdownTransformOptions {
	stripMedia?: boolean;
}

function formatMediaSources(
	sourceDeclaration: string,
	stripMedia: boolean,
	altText: string,
): string {
	if (stripMedia) {
		return '';
	}

	const sources = sourceDeclaration
		.split(',')
		.map((item) => item.trim().replace(/^"|"$/g, ''))
		.filter(Boolean);

	if (sources.length === 0) {
		return '';
	}

	const items = sources.map((filename) => {
		const fullUrl = `${CDN.mediaUrl}${filename}`;
		const altLabel = altText.trim();
		const displayLabel = altLabel.length > 0 ? altLabel : filename;

		return `[${displayLabel}](${fullUrl})`;
	});

	return `\n${items.join('\n\n')}\n`;
}

/**
 * Converts MDX content to plain markdown body (without YAML frontmatter).
 * Internal helper used by toMarkdown() and formatStudyArtifactsAsMarkdown().
 *
 * @param _frontmatter - Validated frontmatter (unused but kept for consistency)
 * @param content - Raw MDX content
 * @param options - Transformation options (strip media, etc.)
 * @returns Clean markdown body without frontmatter
 */
function toMarkdownBody(
	_frontmatter: ContentItem,
	content: string,
	options: MarkdownTransformOptions = {},
): string {
	const { stripMedia = false } = options;

	let markdown = content;

	markdown = markdown.replace(/<MdxParagraph>\s*/g, '');
	markdown = markdown.replace(/\s*<\/MdxParagraph>/g, '');

	markdown = markdown.replace(/<MdxMedia\s+[^>]*\/>/g, (match) => {
		const srcMatch = match.match(/src=\{\[([^\]]+)\]\}/);
		const src = srcMatch?.[1];
		if (!src) {
			return '';
		}

		const altMatch = match.match(/alt="([^"]+)"/);
		const altCandidate = altMatch?.[1];
		const altText: string =
			typeof altCandidate === 'string' && altCandidate.length > 0 ? altCandidate : '';
		return formatMediaSources(src, stripMedia, altText);
	});

	markdown = markdown.replace(/^import\s+.*$/gm, '');
	markdown = markdown.replace(/^export\s+.*$/gm, '');
	markdown = markdown.replace(/\n{3,}/g, '\n\n');
	markdown = markdown.trim();

	return markdown;
}

/**
 * Transforms MDX content to plain markdown with YAML frontmatter.
 * Used by Raw Content API for .md/.txt exports.
 *
 * @param frontmatter - Validated frontmatter
 * @param content - Raw MDX content
 * @returns Plain markdown with YAML frontmatter
 */
export function toMarkdown(frontmatter: ContentItem, content: string): string {
	const startTime = performance.now();

	const markdown = toMarkdownBody(frontmatter, content);

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
