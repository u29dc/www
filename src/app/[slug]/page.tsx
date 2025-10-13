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
import { Wrapper } from '@/components/ui/wrapper';
import { getAllContent, getContentBySlug } from '@/lib/mdx/aggregator';
import { useMDXComponents } from '@/lib/mdx/components';
import type { ContentPageProps } from '@/lib/types/components';
import { getContentDescription } from '@/lib/utils/formatters';

export default async function ContentPage({ params }: ContentPageProps) {
	const { slug } = await params;
	const content = await getContentBySlug(slug);

	if (!content) notFound();

	const { frontmatter, content: mdxContent } = content;

	return (
		<Wrapper type="page-content" frontmatter={frontmatter}>
			<div></div>
			<MDXRemote source={mdxContent} components={useMDXComponents({})} />
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
	const content = await getContentBySlug(slug);

	if (!content) return { title: 'Not Found' };

	const description = getContentDescription(content.frontmatter);

	return {
		title: content.frontmatter.title,
		description,
		alternates: {
			canonical: `/${slug}`,
		},
	};
}
