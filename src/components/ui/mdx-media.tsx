/**
 * MDX Media Component
 *
 * ## SUMMARY
 * Dynamic aspect ratio-based media layout using Flexbox. Automatically calculates
 * optimal height based on container width and sum of aspect ratios, then distributes
 * width proportionally while maintaining equal heights.
 *
 * ## RESPONSIBILITIES
 * - Measure container width and track resize events
 * - Collect aspect ratios from child media items via React Context
 * - Calculate optimal height: containerWidth ÷ sumOfAspectRatios
 * - Calculate proportional flex-basis values for each item
 * - Ensure perfect fit with no dead space or overflow
 *
 * ## USAGE
 * ```mdx
 * <MdxMedia>
 *   <MdxMediaItem src="Square.webp" />      <!-- 1:1 aspect ratio -->
 *   <MdxMediaItem src="Landscape.webp" />   <!-- 2:1 aspect ratio -->
 * </MdxMedia>
 * ```
 * Result: If container is 1200px wide, height = 1200 ÷ (1+2) = 400px
 *         Square gets 400px width, Landscape gets 800px width
 *
 * ## KEY FLOWS
 * 1. Component mounts, measures container width via ref
 * 2. ResizeObserver tracks width changes for responsive behavior
 * 3. Children register aspect ratios after media loads
 * 4. Calculate height: width ÷ sumOfAspectRatios
 * 5. Calculate flex-basis for each child: (ratio ÷ sumOfRatios) × 100%
 * 6. Children receive flex-basis via context and render proportionally
 *
 * @module components/ui/mdx-media
 */

'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MdxMediaProps, MediaLayoutContextValue } from '@/lib/types/components';

export const MediaLayoutContext = createContext<MediaLayoutContextValue | null>(null);

export function MdxMedia({ children }: MdxMediaProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState<number>(0);
	const [aspectRatios, setAspectRatios] = useState<Map<string, number>>(new Map());

	// Measure container width and track resize
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		// Initial measurement
		setContainerWidth(container.offsetWidth);

		// Track resize with ResizeObserver
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
				setContainerWidth(width);
			}
		});

		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	// Register aspect ratio from child item
	// Memoized to prevent infinite render loops in child useEffect
	const registerItem = useCallback((id: string, aspectRatio: number) => {
		setAspectRatios((prev) => {
			const next = new Map(prev);
			next.set(id, aspectRatio);
			return next;
		});
	}, []); // No dependencies - uses functional state update

	// Calculate flex-basis for each item based on aspect ratios
	// Memoized to prevent unnecessary context updates
	const getFlexBasis = useCallback(
		(id: string): string => {
			const ratio = aspectRatios.get(id);
			if (!ratio || aspectRatios.size === 0) {
				return '1'; // Fallback: equal distribution
			}

			const totalRatio = Array.from(aspectRatios.values()).reduce((sum, r) => sum + r, 0);
			const percentage = (ratio / totalRatio) * 100;
			return `${percentage}%`;
		},
		[aspectRatios],
	); // Depends on aspectRatios Map

	// Calculate optimal height: containerWidth ÷ sumOfAspectRatios
	const calculateHeight = (): number => {
		if (!containerWidth || aspectRatios.size === 0) {
			return 0; // Not ready yet
		}

		const totalRatio = Array.from(aspectRatios.values()).reduce((sum, r) => sum + r, 0);

		return containerWidth / totalRatio;
	};

	const calculatedHeight = calculateHeight();

	// Track when layout is ready to fade in (prevents jump during calculation)
	const isLayoutReady = containerWidth > 0 && aspectRatios.size > 0 && calculatedHeight > 0;

	// Memoize context value to prevent infinite render loops
	// Only recreates when callbacks change
	const contextValue = useMemo(
		(): MediaLayoutContextValue => ({
			registerItem,
			getFlexBasis,
		}),
		[registerItem, getFlexBasis],
	);

	return (
		<MediaLayoutContext.Provider value={contextValue}>
			<div
				ref={containerRef}
				className={`flex gap-2 md:gap-5 col-span-full px-[5px] transition-opacity duration-300 ${
					isLayoutReady ? 'opacity-100' : 'opacity-0'
				}`}
				style={calculatedHeight > 0 ? { height: `${calculatedHeight}px` } : {}}
			>
				{children}
			</div>
		</MediaLayoutContext.Provider>
	);
}
