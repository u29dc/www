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
 * - Provide timeline coordination via page-level wrapper
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
import { AnimatedMdxContent } from '@/components/base-animated-mdx-content';
import { TimelinePageWrapper } from '@/components/base-timeline-page-wrapper';
import { ComposedLayoutWrapper } from '@/components/composed-layout-wrapper';
import { contentTimeline } from '@/lib/animation/configs';
import { getContentBySlug, getFeedContent } from '@/lib/mdx/aggregator';
import { useMDXComponents } from '@/lib/mdx/components';
import { getContentDescription } from '@/lib/utils/formatters';

/** Content page component props (dynamic route) */
export interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
	const { slug } = await params;
	const content = await getContentBySlug(slug);

	if (!content) notFound();

	// Block non-feed items from HTML rendering (they should only be accessible via .md/.txt)
	if (content.frontmatter.isFeedItem === false) {
		notFound();
	}

	const { frontmatter, content: mdxContent } = content;

	return (
		<TimelinePageWrapper config={contentTimeline}>
			<ComposedLayoutWrapper type="page-content" frontmatter={frontmatter}>
				<AnimatedMdxContent>
					<MDXRemote source={mdxContent} components={useMDXComponents({})} />
				</AnimatedMdxContent>
			</ComposedLayoutWrapper>
		</TimelinePageWrapper>
	);
}

export async function generateStaticParams() {
	const feedContent = await getFeedContent();
	return feedContent.map(({ frontmatter }) => ({
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
