/**
 * Layout Content Block
 *
 * ## SUMMARY
 * Reusable section wrapper for content areas with accessible metadata.
 *
 * ## RESPONSIBILITIES
 * - Provide semantic section container with ID and title metadata
 * - Enable page structure discovery via data attributes
 * - Support future visual styling for section boundaries
 *
 * @module components/layout/layout-content-block
 */

import type { ReactNode } from 'react';

export interface LayoutContentBlockProps {
	id: string | number;
	title: string;
	children: ReactNode;
}

export function LayoutContentBlock({ id, title, children }: LayoutContentBlockProps) {
	return (
		<div data-id={id} data-title={title} className="grid grid-cols-10 col-span-full">
			{children}
		</div>
	);
}
