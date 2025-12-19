import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { CDN } from '$lib/constants';
import { type ContentItem, ContentSchema, isStudy, type ParsedContent } from '$lib/content-types';
import { NotFoundError } from '$lib/errors';
import { logEvent } from '$lib/logger';

export async function getAllContent(): Promise<ParsedContent[]> {
	const contentDir = path.join(process.cwd(), 'src/content');
	const files = await fs.readdir(contentDir);
	const mdxFiles = files.filter((file) => file.endsWith('.mdx'));

	const content = await Promise.all(
		mdxFiles.map(async (file) => {
			const filePath = path.join(contentDir, file);
			return parseMdx(filePath);
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

export async function getArtifactsContent(): Promise<ParsedContent[]> {
	const allContent = await getAllContent();
	return allContent.filter((item) => item.frontmatter.isArtifactItem === true);
}

export async function getStudyArtifacts(): Promise<ParsedContent[]> {
	const artifacts = await getArtifactsContent();
	return artifacts.filter((item) => isStudy(item.frontmatter) && !(item.frontmatter.isConfidential ?? false));
}

export function formatStudyArtifactsAsMarkdown(studies: ParsedContent[], maxCount?: number): string {
	if (studies.length === 0) {
		return '<!-- No study artifacts currently available -->\n';
	}

	const limitedStudies = maxCount ? studies.slice(0, maxCount) : studies;

	const sections = limitedStudies.map((study) => {
		const { title } = study.frontmatter;
		const bodyMarkdown = toMarkdownBody(study.frontmatter, study.content, { stripMedia: true });
		return `### ${title}\n\n${bodyMarkdown}`;
	});

	return sections.join('\n\n');
}

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

export async function getContentBySlug(slug: string): Promise<ParsedContent | null> {
	try {
		const contentDir = path.join(process.cwd(), 'src/content');
		const filePath = path.join(contentDir, `${slug}.mdx`);
		const result = await parseMdx(filePath);

		logEvent('MDX', 'GET_BY_SLUG', 'SUCCESS', { slug });
		return result;
	} catch {
		logEvent('MDX', 'GET_BY_SLUG', 'FAIL', { slug });
		return null;
	}
}

export async function parseMdx(filePath: string): Promise<ParsedContent> {
	try {
		const source = await fs.readFile(filePath, 'utf8');
		const { data, content } = matter(source);
		const parsedData = data as { date?: string | Date } & Record<string, unknown>;

		const dateValue = parsedData.date;
		if (dateValue instanceof Date) {
			parsedData.date = dateValue.toISOString();
		}

		const frontmatter = ContentSchema.parse(parsedData);

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

interface MarkdownTransformOptions {
	stripMedia?: boolean;
}

function formatMediaSources(sourceDeclaration: string, stripMedia: boolean, altText: string): string {
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

function toMarkdownBody(_frontmatter: ContentItem, content: string, options: MarkdownTransformOptions = {}): string {
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
		const altText: string = typeof altCandidate === 'string' && altCandidate.length > 0 ? altCandidate : '';
		return formatMediaSources(src, stripMedia, altText);
	});

	markdown = markdown.replace(/^import\s+.*$/gm, '');
	markdown = markdown.replace(/^export\s+.*$/gm, '');
	markdown = markdown.replace(/\n{3,}/g, '\n\n');
	markdown = markdown.trim();

	return markdown;
}

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
