'use client';

/**
 * Scroll-bound overlay component
 *
 * ## SUMMARY
 * Displays a horizontal line mapped to page scroll and a CTA box tracking mouse X.
 *
 * ## RESPONSIBILITIES
 * - Map window scroll to vertical line position (0-500px) relative to content only (excluding footer)
 * - Track mouse X for CTA positioning with constrained range
 * - Provide smooth spring animation for both axes
 *
 * @module components/core/scroll-overlay
 */

import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTimelineStage } from '@/lib/timeline';

export function CoreScrollOverlay() {
	// 1. Vertical Motion (Scroll)
	const { scrollY } = useScroll();
	const maxScroll = useMotionValue(1000); // Default to avoid initial layout jump

	// Update measurement on load/resize to exclude footer
	useEffect(() => {
		const updateMeasurements = () => {
			const footer = document.querySelector('[data-section="footer"]');
			const footerHeight = footer?.getBoundingClientRect().height || 0;
			const docHeight = document.documentElement.scrollHeight;
			const winHeight = window.innerHeight;

			// Calculate max scrollable distance excluding footer
			// When we reach this point, the visual line should be at 100%
			// Ensure we have at least some scrollable area (min 1px)
			const scrollableHeight = Math.max(docHeight - winHeight - footerHeight, 1);
			maxScroll.set(scrollableHeight);
		};

		// Initial check
		updateMeasurements();

		// Handle resize
		window.addEventListener('resize', updateMeasurements);

		// Use ResizeObserver for dynamic content height changes
		const observer = new ResizeObserver(updateMeasurements);
		observer.observe(document.body);

		return () => {
			window.removeEventListener('resize', updateMeasurements);
			observer.disconnect();
		};
	}, [maxScroll]);

	// Map scrollY to container height (0-500px) based on content-only height
	// Using raw scrollY mapped to our calculated maxScroll
	const rawLineY = useTransform(scrollY, (latest) => {
		const max = maxScroll.get();
		const progress = Math.min(Math.max(latest / max, 0), 1);
		return progress * 500;
	});

	// Smooth scroll progress
	const lineY = useSpring(rawLineY, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	});

	// 2. Horizontal Motion (Mouse)
	const mouseX = useMotionValue(0);
	const windowWidth = useMotionValue(0);
	const [isMdUp, setIsMdUp] = useState(false);

	// Timeline-driven animation stages
	const {
		variant: lineVariant,
		advanceStage: advanceLineStage,
		stageConfig: lineStageConfig,
		stage: lineStage,
	} = useTimelineStage('index-scroll-line');
	const {
		variant: ctaVariant,
		advanceStage: advanceCtaStage,
		stageConfig: ctaStageConfig,
		stage: ctaStage,
	} = useTimelineStage('index-scroll-cta');

	// Smooth mouse tracking with adjusted physics for "following" feel
	const smoothMouseX = useSpring(mouseX, {
		stiffness: 60,
		damping: 30,
		mass: 1,
	});

	// Magnetic Attraction Logic:
	// "Element should follow mouse position smoothly"
	// "Attraction effect with ~50px left/right range"
	// "Smooth easing (no abrupt stops)"
	//
	// Logic:
	// 1. Calculate distance from anchor (90% width)
	// 2. Use tanh for soft clamping (infinite smooth approach to limit)
	// 3. Direction: Mouse Left of Anchor -> Box Moves Left (Follows/Attracts)
	const boxX = useTransform([smoothMouseX, windowWidth], (values: number[]) => {
		const latestMouseX = values[0] ?? 0;
		const latestWidth = values[1] ?? 0;

		// Initial render safety
		if (!latestWidth) return 0;

		const anchor = latestWidth * 0.2;
		// diff < 0 when mouse is left of anchor (should move left)
		// diff > 0 when mouse is right of anchor (should move right)
		const diff = latestMouseX - anchor;

		// Use tanh for smooth easing without hard stops
		// Input range approx +/- window width
		// We want to reach near max range when far away?
		// Or only react when close?
		// "Follow mouse position" implies reacting to global position usually.
		// Sensitivity: 0.002 means at 1000px diff, we are at tanh(2) ~= 0.96 * 50px
		return Math.tanh(diff * 0.003) * 50;
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;

		const updateSize = () => {
			const width = window.innerWidth;
			windowWidth.set(width);
			setIsMdUp(window.matchMedia('(min-width: 768px)').matches);
		};

		updateSize();
		if (isMdUp) {
			mouseX.set(window.innerWidth / 2);
		}

		const handleMouseMove = (e: MouseEvent) => {
			if (!isMdUp) return;
			mouseX.set(e.clientX);
		};

		window.addEventListener('resize', updateSize);
		if (isMdUp) {
			window.addEventListener('mousemove', handleMouseMove);
		}

		return () => {
			window.removeEventListener('resize', updateSize);
			if (isMdUp) {
				window.removeEventListener('mousemove', handleMouseMove);
			}
		};
	}, [isMdUp, mouseX, windowWidth]);

	const anchorLeft = isMdUp ? '20%' : '100%';

	// Animation variants
	const lineVariants = {
		hidden: { opacity: 0, scaleX: 0, filter: 'blur(6px)' },
		visible: { opacity: 1, scaleX: 1, filter: 'blur(0px)' },
	};

	const ctaVariants = {
		hidden: { opacity: 0, filter: 'blur(8px)' },
		visible: { opacity: 1, filter: 'blur(0px)' },
	};

	const lineDuration = (lineStageConfig?.duration ?? 600) / 1000;
	const ctaDuration = (ctaStageConfig?.duration ?? 500) / 1000;

	return (
		// Container: Fixed, centered, 500px height, pass-through clicks
		// Z-Index: 20 (Above header, below grid/footer)
		<div className="-translate-y-1/2 padding-standard pointer-events-none fixed top-1/2 left-0 z-20 h-[500px] w-full select-none">
			{/* Horizontal Line + CTA wrapper (shares vertical motion, decoupled from line scale) */}
			<motion.div style={{ y: lineY }} className="relative h-[1px] w-full">
				{/* Animated line */}
				<motion.div
					className="absolute inset-0 origin-left bg-black"
					initial={false}
					variants={lineVariants}
					animate={lineVariant}
					transition={{
						duration: lineDuration,
						ease: [0.22, 1, 0.36, 1],
					}}
					onAnimationComplete={() => {
						if (lineStage?.status === 'animating') {
							advanceLineStage();
						}
					}}
				/>

				{/* CTA Box: tracks mouse on md+, pinned right on sm/xs */}
				<motion.div
					style={{ x: isMdUp ? boxX : 0, left: anchorLeft }}
					className="pointer-events-auto absolute top-[1px]"
					initial={false}
					variants={ctaVariants}
					animate={ctaVariant}
					transition={{
						duration: ctaDuration,
						ease: [0.22, 1, 0.36, 1],
					}}
					onAnimationComplete={() => {
						if (ctaStage?.status === 'animating') {
							advanceCtaStage();
						}
					}}
				>
					<a href={'https://cal.com/u29dc'} target="_blank" rel="noopener noreferrer">
						{/* Centered on X coordinate */}
						<div
							className={`${
								isMdUp ? '-translate-x-1/2' : '-translate-x-full'
							} whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white`}
						>
							BOOK A CALL
						</div>
					</a>
				</motion.div>
			</motion.div>
		</div>
	);
}
