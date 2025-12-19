import type { SvelteComponent } from 'svelte';
import { type ContentItem, ContentSchema } from '$lib/content-types';

type MdxModule = {
	default: typeof SvelteComponent;
	metadata?: unknown;
	frontmatter?: unknown;
};

export interface MdxEntry {
	slug: string;
	component: typeof SvelteComponent;
	frontmatter: ContentItem;
}

const modules = import.meta.glob('/src/content/*.mdx', { eager: true });

const entries: MdxEntry[] = Object.entries(modules).map(([filePath, module]) => {
	const mdxModule = module as MdxModule;
	const filename = filePath.split('/').pop() ?? '';
	const slug = filename.replace(/\.mdx$/, '');
	const metadata = mdxModule.metadata ?? mdxModule.frontmatter ?? {};
	const frontmatter = ContentSchema.parse(metadata);

	return {
		slug,
		component: mdxModule.default,
		frontmatter,
	};
});

export function getMdxEntry(slug: string): MdxEntry | null {
	return entries.find((entry) => entry.slug === slug) ?? null;
}

export function getAllMdxEntries(): MdxEntry[] {
	return entries;
}
