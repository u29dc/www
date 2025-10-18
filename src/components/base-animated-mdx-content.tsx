'use client';

/**
 * Animated MDX Content
 *
 * ## SUMMARY
 * Timeline-aware wrapper for MDX content with AnimatedSection.
 *
 * ## RESPONSIBILITIES
 * - Wrap MDX content in AnimatedSection with 'content' stageId
 * - Coordinate content animation with timeline stages
 *
 * ## USAGE
 * ```tsx
 * <AnimatedMdxContent>
 *   <MDXRemote source={content} components={components} />
 * </AnimatedMdxContent>
 * ```
 *
 * @module components/base-animated-mdx-content
 */

import type { ReactNode } from 'react';
import { AnimatedSection } from '@/components/base-animated-section';

export interface AnimatedMdxContentProps {
	children: ReactNode;
}

/**
 * AnimatedMdxContent component
 *
 * Wraps MDX content with timeline-coordinated fade animation.
 */
export function AnimatedMdxContent({ children }: AnimatedMdxContentProps) {
	return (
		<AnimatedSection stageId="content-body" className="col-span-full grid grid-cols-10">
			{children}
		</AnimatedSection>
	);
}
