import type { ArtifactEntry } from './content';
import { formatDate } from './content';
import { SITE } from './constants';
import { parseMediaSource } from './media';

const rawModules = import.meta.glob('../content/*.mdx', {
	eager: true,
	import: 'default',
	query: '?raw',
});

const rawFiles = rawModules as Record<string, string>;

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

const extractFrontmatter = (raw: string): string => raw.match(FRONTMATTER_PATTERN)?.[1] ?? '';

const extractSlug = (raw: string): string | undefined => {
	const slug = extractFrontmatter(raw)
		.match(/^slug:\s*['"]?([^'"\n]+)['"]?$/m)?.[1]
		?.trim();
	return slug && slug.length > 0 ? slug : undefined;
};

const rawBySlug = new Map(
	Object.values(rawFiles)
		.map((raw) => [extractSlug(raw), raw])
		.filter((entry): entry is [string, string] => typeof entry[0] === 'string'),
);

const stripFrontmatter = (raw: string): string => raw.replace(FRONTMATTER_PATTERN, '');

const cleanBlock = (value: string): string =>
	value
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

const parseComponentSources = (attributes: string): string[] => {
	const sourceExpression = attributes.match(/src=\{([^}]+)\}/)?.[1] ?? attributes.match(/src=["']([^"']+)["']/)?.[1] ?? '';
	const quotedSources = [...sourceExpression.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((source): source is string => Boolean(source));
	return quotedSources.length > 0 && !sourceExpression.includes('[') ? [quotedSources[0] as string] : quotedSources;
};

const mediaToMarkdown = (attributes: string): string => {
	const sources = parseComponentSources(attributes);
	if (sources.length === 0) return '';

	return sources
		.map((source) => {
			const media = parseMediaSource(source);
			const label = media.kind === 'video' ? 'Video' : 'Image';
			return `[${label}: ${media.path}](${media.url})`;
		})
		.join('\n');
};

const quoteToMarkdown = (_match: string, content: string): string =>
	cleanBlock(content)
		.split('\n')
		.map((line) => (line.trim().length === 0 ? '>' : `> ${line}`))
		.join('\n');

export const getRawArtifactMarkdown = (slug: string): string => {
	const raw = rawBySlug.get(slug);
	if (!raw) {
		throw new Error(`Missing raw MDX source for slug "${slug}"`);
	}
	return raw;
};

export const toMarkdownBody = (raw: string): string => {
	const body = stripFrontmatter(raw)
		.replace(/^import\s.+$/gm, '')
		.replace(/^export\s.+$/gm, '')
		.replace(/<MdxParagraph>\s*/g, '')
		.replace(/\s*<\/MdxParagraph>/g, '')
		.replace(/<MdxSpacer\s*\/>/g, '')
		.replace(/<MdxMedia\s+([^>]*)\/>/g, (_match: string, attributes: string) => mediaToMarkdown(attributes))
		.replace(/<MdxQuote>\s*([\s\S]*?)\s*<\/MdxQuote>/g, quoteToMarkdown);

	return cleanBlock(body);
};

export const artifactUrl = (entry: ArtifactEntry): string => new URL(`/${entry.data.slug}/`, SITE.url).toString();

export const artifactMarkdownUrl = (entry: ArtifactEntry): string => new URL(`/${entry.data.slug}.md`, SITE.url).toString();

export const artifactTextUrl = (entry: ArtifactEntry): string => new URL(`/${entry.data.slug}.txt`, SITE.url).toString();

export const toArtifactMarkdown = (entry: ArtifactEntry): string => {
	const details = [
		`Type: ${entry.data.type === 'study' ? 'Study' : 'Writing'}`,
		`Date: ${formatDate(entry.data.date)}`,
		`URL: ${artifactUrl(entry)}`,
		`Markdown: ${artifactMarkdownUrl(entry)}`,
		`Text: ${artifactTextUrl(entry)}`,
	];

	if (entry.data.type === 'study') {
		details.push(`Client: ${entry.data.client}`);
		details.push(`Role: ${entry.data.role}`);
		details.push(`Mode: ${entry.data.mode}`);
		if (entry.data.venue) details.push(`Venue: ${entry.data.venue}`);
	}

	const raw = getRawArtifactMarkdown(entry.data.slug);

	return cleanBlock([`# ${entry.data.title}`, entry.data.description, details.join('\n'), '---', toMarkdownBody(raw)].join('\n\n'));
};
