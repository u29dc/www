'use client';

/**
 * Atomic Gradient Blur
 *
 * ## SUMMARY
 * Layered blur effect at container edges using backdrop-filter and CSS gradient masks.
 *
 * ## RESPONSIBILITIES
 * - Generate stacked blur layers with progressive intensity and configurable curves
 *
 * @module components/atomic/atomic-gradient-blur
 */

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export type BlurPosition = 'top' | 'bottom' | 'left' | 'right';
export type BlurCurve = 'linear' | 'ease-in' | 'ease-out' | 'bezier';

export interface AtomicGradientBlurProps {
	position?: BlurPosition;
	strength?: number;
	size?: string;
	layers?: number;
	curve?: BlurCurve;
	exponential?: boolean;
	animated?: boolean;
	opacity?: number;
	fixed?: boolean;
	className?: string;
	children?: ReactNode;
}

const DEFAULT_CONFIG = {
	position: 'bottom' as BlurPosition,
	strength: 3,
	size: '6rem',
	layers: 5,
	curve: 'bezier' as BlurCurve,
	exponential: true,
	animated: false,
	opacity: 1,
	fixed: true,
	className: '',
} as const;

function applyCurve(progress: number, curve: BlurCurve): number {
	switch (curve) {
		case 'linear':
			return progress;
		case 'ease-in':
			return progress * progress;
		case 'ease-out':
			return 1 - (1 - progress) ** 2;
		case 'bezier':
			return progress * progress * (3 - 2 * progress);
		default:
			return progress;
	}
}

function calculateBlur(
	layerIndex: number,
	totalLayers: number,
	strength: number,
	curve: BlurCurve,
	exponential: boolean,
): number {
	const progress = (layerIndex + 1) / totalLayers;
	const curvedProgress = applyCurve(progress, curve);

	if (exponential) {
		return 2 ** (curvedProgress * 4) * 0.0625 * strength;
	}

	return 0.0625 * (curvedProgress * totalLayers + 1) * strength;
}

function getGradientDirection(position: BlurPosition): string {
	const directions: Record<BlurPosition, string> = {
		top: 'to top',
		bottom: 'to bottom',
		left: 'to left',
		right: 'to right',
	};
	return directions[position];
}

function generateMaskGradient(layerIndex: number, totalLayers: number): string {
	const increment = 100 / totalLayers;
	const start = Math.round(increment * layerIndex * 10) / 10;
	const middle = Math.round(increment * (layerIndex + 1) * 10) / 10;
	const end = Math.round(increment * (layerIndex + 2) * 10) / 10;
	const final = Math.round(increment * (layerIndex + 3) * 10) / 10;

	let gradient = `transparent ${start}%, black ${middle}%`;
	if (end <= 100) gradient += `, black ${end}%`;
	if (final <= 100) gradient += `, transparent ${final}%`;

	return gradient;
}

function useScrollVisible(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean): boolean {
	const [isVisible, setIsVisible] = useState(!enabled);

	useEffect(() => {
		if (!enabled || !ref.current) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry) {
					setIsVisible(entry.isIntersecting);
				}
			},
			{ threshold: 0.1 },
		);

		observer.observe(ref.current);
		return () => observer.disconnect();
	}, [ref, enabled]);

	return isVisible;
}

export function AtomicGradientBlur(props: AtomicGradientBlurProps) {
	const config = { ...DEFAULT_CONFIG, ...props };
	const containerRef = useRef<HTMLDivElement>(null);
	const isVisible = useScrollVisible(containerRef, config.animated);

	const layers: ReactNode[] = [];
	for (let i = 0; i < config.layers; i++) {
		const blurValue = calculateBlur(
			i,
			config.layers,
			config.strength,
			config.curve,
			config.exponential,
		);
		const maskGradient = generateMaskGradient(i, config.layers);
		const direction = getGradientDirection(config.position);

		const layerStyle: CSSProperties = {
			maskImage: `linear-gradient(${direction}, ${maskGradient})`,
			WebkitMaskImage: `linear-gradient(${direction}, ${maskGradient})`,
			backdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
			opacity: config.opacity,
			transform: 'translateZ(0)',
			willChange: 'transform',
		};

		layers.push(<div key={i} className="absolute inset-0" style={layerStyle} />);
	}

	const isVertical = config.position === 'top' || config.position === 'bottom';
	const containerStyle: CSSProperties = {
		position: config.fixed ? 'fixed' : 'absolute',
		pointerEvents: 'none',
		opacity: isVisible ? 1 : 0,
		transition: config.animated ? 'opacity 0.3s ease-out' : undefined,
		zIndex: 1000,
		contain: 'layout style paint',
		[config.position]: 0,
	};

	if (isVertical) {
		containerStyle.height = config.size;
		containerStyle.width = '100%';
		containerStyle.left = 0;
		containerStyle.right = 0;
	} else {
		containerStyle.width = config.size;
		containerStyle.height = '100%';
		containerStyle.top = 0;
		containerStyle.bottom = 0;
	}

	return (
		<div
			ref={containerRef}
			className={`relative isolate hidden md:block ${config.className}`}
			style={containerStyle}
		>
			<div className="relative full-container">{layers}</div>
			{config.children && <div className="relative">{config.children}</div>}
		</div>
	);
}
