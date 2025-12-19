import matter from 'gray-matter';
import yaml from 'js-yaml';
import { CDN } from '$lib/constants';
import { type ContentItem, ContentSchema, isStudy, type ParsedContent } from '$lib/content-types';
import { NotFoundError } from '$lib/errors';
import { logEvent } from '$lib/logger';

type MdxEntry = {
	filePath: string;
	filename: string;
	slug: string;
	source: string;
};

const mdxModules = import.meta.glob('/src/content/*.mdx', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const mdxEntries: MdxEntry[] = Object.entries(mdxModules)
	.map(([filePath, source]) => {
		const filename = filePath.split('/').pop() ?? filePath;
		const slug = filename.replace(/\.mdx$/, '');
		return { filePath, filename, slug, source };
	})
	.filter((entry) => entry.slug.length > 0);

const mdxBySlug = new Map<string, MdxEntry>(mdxEntries.map((entry) => [entry.slug, entry]));

export async function getAllContent(): Promise<ParsedContent[]> {
	const content = await Promise.all(mdxEntries.map((entry) => parseMdx(entry.source, entry.filePath)));

	const sorted = content.sort((a, b) => {
		const dateA = new Date(a.frontmatter.date).getTime();
		const dateB = new Date(b.frontmatter.date).getTime();
		return dateB - dateA;
	});

	logEvent('MDX', 'AGGREGATE', 'SUCCESS', {
		count: sorted.length,
		files: mdxEntries.map((entry) => entry.filename),
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
	const entry = mdxBySlug.get(slug);
	if (!entry) {
		logEvent('MDX', 'GET_BY_SLUG', 'FAIL', { slug });
		return null;
	}

	try {
		const result = await parseMdx(entry.source, entry.filePath);

		logEvent('MDX', 'GET_BY_SLUG', 'SUCCESS', { slug });
		return result;
	} catch {
		logEvent('MDX', 'GET_BY_SLUG', 'FAIL', { slug });
		return null;
	}
}

export async function parseMdx(source: string, filePath: string): Promise<ParsedContent> {
	try {
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
