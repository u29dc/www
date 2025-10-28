'use client';

/**
 * Animated Content MDX
 *
 * ## SUMMARY
 * Timeline-aware wrapper for MDX content with article-body animation stage.
 *
 * ## RESPONSIBILITIES
 * - Wrap MDX content in AnimatedBlock for timeline-coordinated fade animation
 *
 * @module components/animation/animated-content-mdx
 */

import type { ReactNode } from 'react';
import { AnimatedBlock } from '@/components/animation/animated-block';

export interface AnimatedContentMdxProps {
	children: ReactNode;
}

export function AnimatedContentMdx({ children }: AnimatedContentMdxProps) {
	return (
		<AnimatedBlock stageId="article-body" className="col-span-full grid grid-cols-10">
			{children}
		</AnimatedBlock>
	);
}
