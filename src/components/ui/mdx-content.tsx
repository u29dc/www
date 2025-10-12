/**
 * MDX Content Component
 *
 * ## SUMMARY
 * Wrapper for grouped markdown content (headings + paragraphs).
 * Provides spacing boundary for content sections.
 *
 * ## USAGE
 * ```mdx
 * <MdxContent>
 *
 * # Heading
 * Paragraph text
 *
 * </MdxContent>
 * ```
 *
 * @module components/ui/mdx-content-block
 */

import type { ReactNode } from 'react';

interface MdxContentBlockProps {
	children: ReactNode;
}

export function MdxContent({ children }: MdxContentBlockProps) {
	return <div className="content-column p-5 font-lg">{children}</div>;
}
