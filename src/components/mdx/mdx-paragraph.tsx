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
	return (
		<div className="grid grid-cols-10">
			<div className="col-span-base padding-standard">{children}</div>
		</div>
	);
}
