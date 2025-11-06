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
			className={`padding-standard marker-all mb-30 grid grid-cols-10 py-0 ${className || ''}`}
		>
			<div className="-col-end-1 col-span-base 3xl:col-start-7 col-start-1 row-start-1 font-mono sm:col-start-1 md:col-start-3 lg:col-start-4 xl:col-start-5 2xl:col-start-6">
				<div className="mb-10 rounded-sm border-current/10 border-b text-right md:mb-5 md:text-left">
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
