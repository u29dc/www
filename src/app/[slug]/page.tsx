/**
 * Individual Content Page
 *
 * ## SUMMARY
 * Renders individual content item with metadata, timeline-animated MDX content, and SEO.
 *
 * ## RESPONSIBILITIES
 * - Validate content by slug, generate static params and metadata for SEO
 *
 * @module app/[slug]/page
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { AnimatedMdxContent } from '@/components/animation/animated-mdx-content';
import { CoreTimelineProvider } from '@/components/core/core-timeline-provider';
import { LayoutWrapper } from '@/components/layout/layout-wrapper';
import { articleTimeline } from '@/lib/constants';
import type { ContentItem } from '@/lib/mdx';
import { getContentBySlug, getFeedContent } from '@/lib/mdx';
import { useMDXComponents } from '@/mdx-components';

export interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

function getContentDescription(frontmatter: ContentItem): string {
	return frontmatter.description;
}

export default async function ContentPage({ params }: ContentPageProps) {
	const { slug } = await params;
	const content = await getContentBySlug(slug);

	if (!content) notFound();

	if (content.frontmatter.isFeedItem === false) {
		notFound();
	}

	const { frontmatter, content: mdxContent } = content;

	return (
		<CoreTimelineProvider config={articleTimeline}>
			<LayoutWrapper type="article" frontmatter={frontmatter}>
				<AnimatedMdxContent>
					<MDXRemote source={mdxContent} components={useMDXComponents({})} />
				</AnimatedMdxContent>
			</LayoutWrapper>
		</CoreTimelineProvider>
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
