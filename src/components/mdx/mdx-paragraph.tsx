/**
 * MDX Paragraph
 *
 * ## SUMMARY
 * Wrapper for grouped markdown content with consistent spacing.
 *
 * ## RESPONSIBILITIES
 * - Provide spacing boundary for MDX content sections
 *
 * @module components/mdx/mdx-paragraph
 */

import type { ReactNode } from 'react';

export interface MdxParagraphProps {
	children: ReactNode;
}

export function MdxParagraph({ children }: MdxParagraphProps) {
	return <div className="content-column padding-standard font-lg">{children}</div>;
}
