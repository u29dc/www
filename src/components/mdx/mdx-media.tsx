/**
 * MDX Media
 *
 * ## SUMMARY
 * Aspect ratio-based media layout calculating optimal height and proportional flex-basis.
 *
 * ## RESPONSIBILITIES
 * - Measure container, collect child aspect ratios, calculate proportional flex-basis
 *
 * ## KEY FLOWS
 * 1. Measure container width, track resize events
 * 2. Children register aspect ratios after media load
 * 3. Calculate height: width ÷ sumOfAspectRatios
 * 4. Calculate flex-basis: (ratio ÷ sumOfRatios) × 100%
 *
 * @module components/mdx/mdx-media
 */

'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdxMediaItem } from '@/components/mdx/mdx-media-item';
import { cn } from '@/lib/class';

export interface MdxMediaProps {
	src: string[];
	alt?: string;
}

export interface MediaLayoutContextValue {
	registerItem: (id: string, aspectRatio: number) => void;
	getFlexBasis: (id: string) => string;
}

export const MediaLayoutContext = createContext<MediaLayoutContextValue | null>(null);

export function MdxMedia({ src, alt }: MdxMediaProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState<number>(0);
	const [aspectRatios, setAspectRatios] = useState<Map<string, number>>(new Map());

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let isMounted = true;

		setContainerWidth(container.offsetWidth);

		const resizeObserver = new ResizeObserver((entries) => {
			if (!isMounted) return;

			for (const entry of entries) {
				const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
				setContainerWidth(width);
			}
		});

		resizeObserver.observe(container);

		return () => {
			isMounted = false;
			resizeObserver.disconnect();
		};
	}, []);

	const registerItem = useCallback((id: string, aspectRatio: number) => {
		setAspectRatios((prev) => {
			const next = new Map(prev);
			next.set(id, aspectRatio);
			return next;
		});
	}, []);

	const getFlexBasis = useCallback(
		(id: string): string => {
			const ratio = aspectRatios.get(id);
			if (!ratio || aspectRatios.size === 0) {
				return '1';
			}

			const totalRatio = Array.from(aspectRatios.values()).reduce((sum, r) => sum + r, 0);
			const percentage = (ratio / totalRatio) * 100;
			return `${percentage}%`;
		},
		[aspectRatios],
	);

	const calculateHeight = (): number => {
		if (!containerWidth || aspectRatios.size === 0) {
			return 0;
		}

		const totalRatio = Array.from(aspectRatios.values()).reduce((sum, r) => sum + r, 0);

		return containerWidth / totalRatio;
	};

	const calculatedHeight = calculateHeight();
	const isLayoutReady = containerWidth > 0 && aspectRatios.size > 0 && calculatedHeight > 0;

	const contextValue = useMemo(
		(): MediaLayoutContextValue => ({
			registerItem,
			getFlexBasis,
		}),
		[registerItem, getFlexBasis],
	);

	return (
		<div className="grid grid-cols-10 col-span-full my-2 md:my-5">
			<MediaLayoutContext.Provider value={contextValue}>
				<div
					ref={containerRef}
					className={cn(
						'flex col-start-1 col-span-full px-[5px] transition-opacity duration-300',
						isLayoutReady ? 'opacity-100' : 'opacity-0',
					)}
					style={calculatedHeight > 0 ? { height: `${calculatedHeight}px` } : {}}
				>
					{src.map((source) => (
						<MdxMediaItem key={source} src={source} alt={alt || ''} />
					))}
				</div>
			</MediaLayoutContext.Provider>
		</div>
	);
}
