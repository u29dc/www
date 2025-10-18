/**
 * Feature Content Home Component
 *
 * ## SUMMARY
 * Client-side animated content for homepage with timeline-orchestrated word reveals.
 *
 * ## RESPONSIBILITIES
 * - Render intro text with timeline-coordinated word reveals
 * - Render description with timeline-coordinated word reveals
 * - Sequential animation via timeline stage orchestration
 *
 * ## USAGE
 * ```tsx
 * // Called from page.tsx server component, wrapped in TimelinePageWrapper
 * <FeatureContentHome />
 * ```
 *
 * @module components/feature-content-home
 */

'use client';

import { AnimatedReveal } from '@/components/base-animated-reveal';

export function FeatureContentHome() {
	return (
		<div className="content-column padding-standard">
			<AnimatedReveal stageId="home-title" elementStagger={200}>
				<h2>Incomplete Infinity is an evolving, enigmatic, multifaceted creative</h2>
				<h2>practice, turning complex futures into today's narratives.</h2>
				<h2>It inhabits the space between what is seen and what is felt.</h2>
				<h2>It operates in the deliberate pause, dwells in the charged moment.</h2>
				<h2>It expresses itself... in incomplete form.</h2>
				<h2>After all, isn't true infinity always incomplete?</h2>
			</AnimatedReveal>
			<AnimatedReveal
				stageId="home-description"
				className="mt-10"
				staggerDelay={5}
				blurStrength={5}
			>
				The practice questions premises before refining execution. Asks "why not
				differently?" because the most interesting possibilities emerge not from
				optimization, but from questioning the premise entirely. The work moves between LAB
				(speculative research, public prototypes, new frames for understanding) and COM
				(strategic narrative, decision-grade artifacts for organizations navigating
				complexity). Research generates language; commerce deploys it. Each feeds the other,
				operating in the productive tension between chaos and order, between the mapped and
				the undiscovered.
			</AnimatedReveal>
		</div>
	);
}
