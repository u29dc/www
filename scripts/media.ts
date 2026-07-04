import type { RemarkPlugin } from '@astrojs/markdown-remark';
import type { MdxJsxAttribute, MdxJsxExpressionAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { Node, Parent } from 'unist';

const mediaComponentNames = new Set<string>(['Media', 'MdxMedia']);
const videoExtensions = new Set(['.m4v', '.mov', '.mp4', '.webm']);

const isParentNode = (node: Node): node is Parent => 'children' in node && Array.isArray((node as { children?: unknown }).children);

const isMdxJsxAttribute = (attribute: MdxJsxAttribute | MdxJsxExpressionAttribute): attribute is MdxJsxAttribute => attribute.type === 'mdxJsxAttribute';

const attributeValue = (attribute: MdxJsxAttribute | undefined): string => {
	if (!attribute || attribute.value === null || attribute.value === undefined) return '';
	if (typeof attribute.value === 'string') return attribute.value;
	return attribute.value.value;
};

const componentSources = (sourceExpression: string): string[] => {
	const quotedSources = [...sourceExpression.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((source): source is string => Boolean(source));
	if (quotedSources.length === 0 && sourceExpression.trim().length > 0) return [sourceExpression.trim()];
	return quotedSources.length > 0 && !sourceExpression.includes('[') ? [quotedSources[0] as string] : quotedSources;
};

const mediaExtension = (source: string): string => {
	const pathWithQueryRemoved = source.split(/[?#]/, 1)[0] ?? source;
	const path = pathWithQueryRemoved.replace(/@([0-9]+(?:\.[0-9]+)?)$/, '');
	const dotIndex = path.lastIndexOf('.');
	return dotIndex === -1 ? '' : path.slice(dotIndex).toLowerCase();
};

const hasImageSource = (node: MdxJsxFlowElement): boolean => {
	const source = attributeValue(node.attributes.find((attribute): attribute is MdxJsxAttribute => isMdxJsxAttribute(attribute) && attribute.name === 'src'));
	return componentSources(source).some((item) => !videoExtensions.has(mediaExtension(item)));
};

const hasAttribute = (node: MdxJsxFlowElement, name: string): boolean => node.attributes.some((attribute) => isMdxJsxAttribute(attribute) && attribute.name === name);

const pushAttribute = (node: MdxJsxFlowElement, name: string, value: string): void => {
	if (hasAttribute(node, name)) return;
	node.attributes.push({ type: 'mdxJsxAttribute', name, value });
};

const isMediaNode = (node: Node): node is MdxJsxFlowElement =>
	node.type === 'mdxJsxFlowElement' && typeof (node as MdxJsxFlowElement).name === 'string' && mediaComponentNames.has((node as MdxJsxFlowElement).name ?? '');

const visit = (node: Node, callback: (node: Node) => boolean): boolean => {
	if (callback(node)) return true;

	if (!isParentNode(node)) return false;

	for (const child of node.children) {
		if (visit(child, callback)) return true;
	}

	return false;
};

export const remarkMediaPriority: RemarkPlugin = () => {
	return (tree): void => {
		visit(tree, (node) => {
			if (!isMediaNode(node) || !hasImageSource(node)) {
				return false;
			}

			pushAttribute(node, 'loading', 'eager');
			pushAttribute(node, 'fetchPriority', 'high');
			return true;
		});
	};
};
