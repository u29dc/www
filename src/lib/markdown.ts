import type { ArtifactEntry } from './artifacts';
import { formatDate } from './artifacts';
import { SITE } from '../data/site';
import { parseMediaSource } from './media';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

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

type MdxAttributeValueExpression = {
	type: 'mdxJsxAttributeValueExpression';
	value: string;
};

type MdxAttribute = {
	type: 'mdxJsxAttribute';
	name: string;
	value?: string | MdxAttributeValueExpression | null;
};

type MarkdownNode = {
	type: string;
	name?: string | null;
	value?: string;
	url?: string;
	title?: string | null;
	alt?: string | null;
	identifier?: string;
	label?: string;
	attributes?: MdxAttribute[];
	children?: MarkdownNode[];
	position?: {
		start?: {
			line?: number;
			column?: number;
		};
	};
	[key: string]: unknown;
};

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
const markdownStringifier = unified().use(remarkGfm).use(remarkStringify, {
	bullet: '-',
	emphasis: '_',
	fences: true,
	listItemIndent: 'one',
	rule: '-',
});

const cleanBlock = (value: string): string =>
	value
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

const getAttributeValue = (node: MarkdownNode, name: string): string => {
	const attribute = node.attributes?.find((item) => item.name === name);
	if (!attribute || attribute.value === null || attribute.value === undefined) return '';
	if (typeof attribute.value === 'string') return attribute.value;
	return attribute.value.value;
};

const parseComponentSources = (sourceExpression: string): string[] => {
	const quotedSources = [...sourceExpression.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((source): source is string => Boolean(source));
	if (quotedSources.length === 0 && sourceExpression.trim().length > 0) return [sourceExpression.trim()];
	return quotedSources.length > 0 && !sourceExpression.includes('[') ? [quotedSources[0] as string] : quotedSources;
};

const componentLocation = (node: MarkdownNode): string => {
	const line = node.position?.start?.line;
	const column = node.position?.start?.column;
	return line && column ? ` at ${line}:${column}` : '';
};

const linkNode = (url: string, text: string): MarkdownNode => ({
	type: 'link',
	url,
	title: null,
	children: [{ type: 'text', value: text }],
});

const mediaToMarkdownNodes = (node: MarkdownNode): MarkdownNode[] => {
	const sources = parseComponentSources(getAttributeValue(node, 'src'));
	if (sources.length === 0) {
		throw new Error(`MdxMedia is missing src${componentLocation(node)}`);
	}

	return sources.map((source) => {
		const media = parseMediaSource(source);
		const label = media.kind === 'video' ? 'Video' : 'Image';
		return {
			type: 'paragraph',
			children: [linkNode(media.url, `${label}: ${media.path}`)],
		};
	});
};

const transformTextComponent = (node: MarkdownNode): MarkdownNode => {
	const children = transformNodes(node.children ?? []);

	if (node.name === 'em') {
		return { type: 'emphasis', children };
	}

	if (node.name === 'strong') {
		return { type: 'strong', children };
	}

	if (node.name === 'a' || node.name === 'Link') {
		const href = getAttributeValue(node, 'href');
		if (!href) throw new Error(`${node.name} is missing href${componentLocation(node)}`);
		return { type: 'link', url: href, title: null, children };
	}

	throw new Error(`Unsupported inline MDX component "${node.name ?? 'unknown'}"${componentLocation(node)}`);
};

const transformFlowComponent = (node: MarkdownNode): MarkdownNode[] => {
	const children = transformNodes(node.children ?? []);

	if (node.name === 'MdxParagraph' || node.name === 'Paragraph') {
		return children;
	}

	if (node.name === 'MdxQuote' || node.name === 'Quote') {
		return [{ type: 'blockquote', children }];
	}

	if (node.name === 'MdxSpacer' || node.name === 'Spacer') {
		return [];
	}

	if (node.name === 'MdxMedia' || node.name === 'Media') {
		return mediaToMarkdownNodes(node);
	}

	throw new Error(`Unsupported block MDX component "${node.name ?? 'unknown'}"${componentLocation(node)}`);
};

const transformNode = (node: MarkdownNode): MarkdownNode[] => {
	if (node.type === 'mdxJsxFlowElement') {
		return transformFlowComponent(node);
	}

	if (node.type === 'mdxJsxTextElement') {
		return [transformTextComponent(node)];
	}

	if (node.children) {
		return [{ ...node, children: transformNodes(node.children) }];
	}

	return [node];
};

const transformNodes = (nodes: MarkdownNode[]): MarkdownNode[] => nodes.flatMap(transformNode);

const stripMdxModuleSyntax = (raw: string): string =>
	raw
		.split('\n')
		.filter((line) => {
			const trimmed = line.trimStart();
			return !trimmed.startsWith('import ') && !trimmed.startsWith('export ');
		})
		.join('\n');

const findFirstMdxMediaSource = (nodes: MarkdownNode[], predicate: (source: string) => boolean = () => true): string | undefined => {
	for (const node of nodes) {
		if (node.type === 'mdxJsxFlowElement' && (node.name === 'MdxMedia' || node.name === 'Media')) {
			const source = parseComponentSources(getAttributeValue(node, 'src')).find(predicate);
			if (source) return source;
		}

		const childSource = node.children ? findFirstMdxMediaSource(node.children, predicate) : undefined;
		if (childSource) return childSource;
	}

	return undefined;
};

export const getRawArtifactMarkdown = (slug: string): string => {
	const raw = rawBySlug.get(slug);
	if (!raw) {
		throw new Error(`Missing raw MDX source for slug "${slug}"`);
	}
	return raw;
};

export const getFirstArtifactMediaSource = (entry: ArtifactEntry): string | undefined => {
	const raw = getRawArtifactMarkdown(entry.data.slug);
	const tree = markdownParser.parse(stripMdxModuleSyntax(stripFrontmatter(raw))) as unknown as MarkdownNode;

	return findFirstMdxMediaSource(tree.children ?? []);
};

export const getFirstArtifactImageMediaSource = (entry: ArtifactEntry): string | undefined => {
	const raw = getRawArtifactMarkdown(entry.data.slug);
	const tree = markdownParser.parse(stripMdxModuleSyntax(stripFrontmatter(raw))) as unknown as MarkdownNode;

	return findFirstMdxMediaSource(tree.children ?? [], (source) => parseMediaSource(source).kind === 'image');
};

export const toMarkdownBody = (raw: string): string => {
	const tree = markdownParser.parse(stripMdxModuleSyntax(stripFrontmatter(raw))) as unknown as MarkdownNode;
	tree.children = transformNodes(tree.children ?? []);
	const body = markdownStringifier.stringify(tree as never);

	return cleanBlock(String(body));
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
