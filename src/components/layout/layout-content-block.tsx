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
			<div className="col-span-base row-start-1 col-start-1 sm:col-start-1 md:col-start-3 lg:col-start-4 xl:col-start-5 2xl:col-start-6 3xl:col-start-7 -col-end-1 font-mono">
				<div className="text-right md:text-left mb-10 md:mb-5 border-b border-current/10 rounded-sm">
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
