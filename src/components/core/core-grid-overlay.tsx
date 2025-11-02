'use client';

/**
 * Core Grid Overlay
 *
 * ## SUMMARY
 * Animated development grid overlay with staggered column reveals.
 *
 * ## RESPONSIBILITIES
 * - Render responsive grid dividers (5 mobile, 10 desktop)
 * - Orchestrate staggered top-to-bottom animations on mount
 *
 * @module components/core/core-grid-overlay
 */

import { motion } from 'motion/react';
import { useMemo } from 'react';

const MOBILE_POSITIONS = ['0%', '20%', '40%', '60%', '80%', '100%'];
const DESKTOP_POSITIONS = [
	'0%',
	'10%',
	'20%',
	'30%',
	'40%',
	'50%',
	'60%',
	'70%',
	'80%',
	'90%',
	'100%',
];

const ANIMATION_CONFIG = {
	staggerDelay: 0.1,
	duration: 0.25,
	easing: [0.55, 0, 1, 0.45] as const,
	initialDelay: 0.1,
};

const columnVariants = {
	hidden: {
		height: 0,
		opacity: 0,
	},
	visible: (columnIndex: number) => ({
		height: '100vh',
		opacity: [0, 0.9, 0.1],
		transition: {
			height: {
				delay: ANIMATION_CONFIG.initialDelay + columnIndex * ANIMATION_CONFIG.staggerDelay,
				duration: ANIMATION_CONFIG.duration,
				ease: ANIMATION_CONFIG.easing,
			},
			opacity: {
				delay: ANIMATION_CONFIG.initialDelay + columnIndex * ANIMATION_CONFIG.staggerDelay,
				duration: ANIMATION_CONFIG.duration,
				ease: [0.22, 1, 0.36, 1] as const,
				times: [0, 0.95, 1],
			},
		},
	}),
};

export function CoreGridOverlay() {
	const mobileColumns = useMemo(() => MOBILE_POSITIONS, []);
	const desktopColumns = useMemo(() => DESKTOP_POSITIONS, []);

	return (
		<div className="fixed inset-0 z-1200 pointer-events-none px-2 md:px-5">
			{/* Mobile: 5 columns */}
			<div className="block md:hidden h-full w-full relative">
				{mobileColumns.map((position, index) => (
					<motion.div
						key={`grid-mobile-${position}`}
						custom={index}
						initial="hidden"
						animate="visible"
						variants={columnVariants}
						className="absolute top-0 w-px"
						style={{
							left: position,
							background:
								'repeating-linear-gradient(to bottom, currentColor 0, currentColor 4px, transparent 4px, transparent 8px)',
						}}
					/>
				))}
			</div>

			{/* Desktop: 10 columns */}
			<div className="hidden md:block h-full w-full relative">
				{desktopColumns.map((position, index) => (
					<motion.div
						key={`grid-desktop-${position}`}
						custom={index}
						initial="hidden"
						animate="visible"
						variants={columnVariants}
						className="absolute top-0 w-px"
						style={{
							left: position,
							background:
								'repeating-linear-gradient(to bottom, currentColor 0, currentColor 4px, transparent 4px, transparent 8px)',
						}}
					/>
				))}
			</div>
		</div>
	);
}
