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
	colSpanFull?: boolean;
	className?: string;
	children: ReactNode;
}

export function LayoutContentBlock({
	id,
	title,
	colSpanFull,
	className,
	children,
}: LayoutContentBlockProps) {
	return (
		<div
			data-id={id}
			data-title={title}
			className={`padding-standard py-0 grid grid-cols-10 mb-30 marker-all ${className || ''}`}
		>
			<div className="col-span-base row-start-1 col-start-1 lg:col-start-1 col-span-full font-mono">
				<div className="text-right md:text-left mb-10 md:mb-5">
					<div className="">[ {title.toUpperCase()} ]</div>
				</div>
			</div>
			<div
				className={`${colSpanFull ? 'col-span-full' : 'col-span-base'} row-start-2 md:row-start-1`}
			>
				{children}
			</div>
		</div>
	);
}
