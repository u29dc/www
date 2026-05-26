type MdxAttributeValue = string | { value?: string } | null | undefined;

interface MdxAttribute {
	type?: string;
	name?: string;
	value?: MdxAttributeValue;
}

interface MdxNode {
	type?: string;
	name?: string;
	attributes?: MdxAttribute[];
	children?: MdxNode[];
}

const mediaComponentNames = new Set(['Media', 'MdxMedia']);
const videoExtensions = new Set(['.m4v', '.mov', '.mp4', '.webm']);

const attributeValue = (attribute: MdxAttribute | undefined): string => {
	if (!attribute || attribute.value === null || attribute.value === undefined) return '';
	if (typeof attribute.value === 'string') return attribute.value;
	return attribute.value.value ?? '';
};

const componentSources = (sourceExpression: string): string[] => {
	const quotedSources = [...sourceExpression.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((source): source is string => Boolean(source));
	if (quotedSources.length === 0 && sourceExpression.trim().length > 0) return [sourceExpression.trim()];
	return quotedSources.length > 0 && !sourceExpression.includes('[') ? [quotedSources[0] as string] : quotedSources;
};

const mediaExtension = (source: string): string => {
	const path = source.split('@', 1)[0]?.split(/[?#]/, 1)[0] ?? source;
	const dotIndex = path.lastIndexOf('.');
	return dotIndex === -1 ? '' : path.slice(dotIndex).toLowerCase();
};

const hasImageSource = (node: MdxNode): boolean => {
	const source = attributeValue(node.attributes?.find((attribute) => attribute.name === 'src'));
	return componentSources(source).some((item) => !videoExtensions.has(mediaExtension(item)));
};

const hasAttribute = (node: MdxNode, name: string): boolean => Boolean(node.attributes?.some((attribute) => attribute.name === name));

const pushAttribute = (node: MdxNode, name: string, value: string): void => {
	node.attributes ??= [];
	if (hasAttribute(node, name)) return;
	node.attributes.push({ type: 'mdxJsxAttribute', name, value });
};

const visit = (node: MdxNode, callback: (node: MdxNode) => boolean): boolean => {
	if (callback(node)) return true;

	for (const child of node.children ?? []) {
		if (visit(child, callback)) return true;
	}

	return false;
};

export function remarkMediaPriority() {
	return (tree: MdxNode): void => {
		visit(tree, (node) => {
			if (node.type !== 'mdxJsxFlowElement' || !node.name || !mediaComponentNames.has(node.name) || !hasImageSource(node)) {
				return false;
			}

			pushAttribute(node, 'loading', 'eager');
			pushAttribute(node, 'fetchPriority', 'high');
			return true;
		});
	};
}
