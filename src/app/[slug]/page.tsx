/**
 * Individual Content Page
 *
 * ## SUMMARY
 * Renders individual content item with metadata and MDX content.
 *
 * ## RESPONSIBILITIES
 * - Parse and validate content by slug
 * - Generate metadata for SEO
 * - Render content header with description
 * - Display type-specific metadata list
 * - Render MDX content with custom components
 *
 * ## USAGE
 * ```tsx
 * // Automatic Next.js dynamic route at /[slug]
 * ```
 *
 * @module app/[slug]/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
// import { MetadataList } from '@/components/ui/metadata-list';
import { Wrapper } from '@/components/ui/wrapper';
import { getAllContent, getContentBySlug } from '@/lib/mdx/aggregator';
import { useMDXComponents } from '@/lib/mdx/components';
import { getContentDescription } from '@/lib/utils/formatters';

interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
	const { slug } = await params;
	const parsed = await getContentBySlug(slug);

	if (!parsed) notFound();

	const { frontmatter, content } = parsed;

	return (
		<Wrapper type="page-content" frontmatter={frontmatter}>
			{/*<MetadataList frontmatter={frontmatter} className="mb-10 content-column p-5" />*/}
			<div></div>
			<MDXRemote source={content} components={useMDXComponents({})} />
		</Wrapper>
	);
}

export async function generateStaticParams() {
	const allContent = await getAllContent();
	return allContent.map(({ frontmatter }) => ({
		slug: frontmatter.slug,
	}));
}

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
	const { slug } = await params;
	const parsed = await getContentBySlug(slug);

	if (!parsed) return { title: 'Not Found' };

	const description = getContentDescription(parsed.frontmatter);

	return {
		title: parsed.frontmatter.title,
		description,
	};
}
