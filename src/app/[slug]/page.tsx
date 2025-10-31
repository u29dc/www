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
import { notFound, redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { AnimatedBlock } from '@/components/animation/animated-block';
import { CoreTimelineProvider } from '@/components/core/core-timeline-provider';
import { LayoutSharedWrapper } from '@/components/layout/layout-shared-wrapper';
import { TIMELINE_ARTICLE } from '@/lib/constants';
import { ValidationError } from '@/lib/errors';
import { getContentBySlug, getFeedContent } from '@/lib/mdx-server';
import type { ContentItem } from '@/lib/mdx-types';
import { isStudy } from '@/lib/mdx-types';
import { validateSlug } from '@/lib/validators';
import { useMDXComponents } from '@/mdx-components';

export interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

function getContentDescription(frontmatter: ContentItem): string {
	return frontmatter.description;
}

export default async function ContentPage({ params }: ContentPageProps) {
	const { slug: rawSlug } = await params;

	// Security: Validate slug format and prevent path traversal attacks
	let slug: string;
	try {
		slug = validateSlug(rawSlug);
	} catch (error) {
		// Treat validation errors as 404 to avoid exposing attack attempts
		if (error instanceof ValidationError) {
			notFound();
		}
		throw error;
	}

	const content = await getContentBySlug(slug);

	if (!content) notFound();

	if (isStudy(content.frontmatter) && (content.frontmatter.isConfidential ?? false)) {
		redirect('/');
	}

	if (content.frontmatter.isFeedItem === false) {
		notFound();
	}

	const { frontmatter, content: mdxContent } = content;

	return (
		<CoreTimelineProvider config={TIMELINE_ARTICLE}>
			<LayoutSharedWrapper type="article" frontmatter={frontmatter}>
				<AnimatedBlock stageId="article-body">
					<MDXRemote source={mdxContent} components={useMDXComponents({})} />
				</AnimatedBlock>
			</LayoutSharedWrapper>
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
	const { slug: rawSlug } = await params;

	// Security: Validate slug format and prevent path traversal attacks
	let slug: string;
	try {
		slug = validateSlug(rawSlug);
	} catch (error) {
		// Return 404 metadata for validation errors
		if (error instanceof ValidationError) {
			return { title: 'Not Found' };
		}
		return { title: 'Not Found' };
	}

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
