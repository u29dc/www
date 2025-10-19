'use client';

/**
 * Animated MDX Content
 *
 * ## SUMMARY
 * Timeline-aware wrapper for MDX content with article-body animation stage.
 *
 * ## RESPONSIBILITIES
 * - Wrap MDX content in AnimatedSection for timeline-coordinated fade animation
 *
 * @module components/animation/animated-mdx-content
 */

import type { ReactNode } from 'react';
import { AnimatedSection } from '@/components/animation/animated-section';

export interface AnimatedMdxContentProps {
	children: ReactNode;
}

export function AnimatedMdxContent({ children }: AnimatedMdxContentProps) {
	return (
		<AnimatedSection stageId="article-body" className="col-span-full grid grid-cols-10">
			{children}
		</AnimatedSection>
	);
}
