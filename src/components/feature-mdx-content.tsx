/**
 * Feature MDX Content Component
 *
 * ## SUMMARY
 * Wrapper for grouped markdown content (headings + paragraphs).
 * Provides spacing boundary for content sections.
 *
 * ## USAGE
 * ```mdx
 * <FeatureMdxContent>
 *
 * # Heading
 * Paragraph text
 *
 * </FeatureMdxContent>
 * ```
 *
 * @module components/feature-mdx-content
 */

import type { ReactNode } from 'react';

/** Feature MDX content component props */
export interface FeatureMdxContentProps {
	children: ReactNode;
}

export function FeatureMdxContent({ children }: FeatureMdxContentProps) {
	return <div className="content-column padding-standard font-lg">{children}</div>;
}
