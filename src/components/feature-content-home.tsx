/**
 * Feature Content Home Component
 *
 * ## SUMMARY
 * Client-side animated content for homepage with sequential reveal animations.
 *
 * ## RESPONSIBILITIES
 * - Manage animation state (showDescription)
 * - Orchestrate sequential BaseAnimationReveal animations
 * - Render intro text with staggered element animation
 * - Trigger description reveal after titles complete
 *
 * ## USAGE
 * ```tsx
 * // Called from page.tsx server component
 * <FeatureContentHome />
 * ```
 *
 * @module components/feature-content-home
 */

'use client';

import { useState } from 'react';
import { BaseAnimationReveal } from '@/components/base-animation-reveal';

export function FeatureContentHome() {
	const [animateDescription, setAnimateDescription] = useState(false);

	return (
		<div className="content-column padding-standard">
			<BaseAnimationReveal
				elementStagger={200}
				onFinished={() => setAnimateDescription(true)}
			>
				<h2>Incomplete Infinity is an evolving, enigmatic, multifaceted creative</h2>
				<h2>practice, turning complex futures into today's narratives.</h2>
				<h2>It inhabits the space between what is seen and what is felt.</h2>
				<h2>It operates in the deliberate pause, dwells in the charged moment.</h2>
				<h2>It expresses itself... in incomplete form.</h2>
				<h2>After all, isn't true infinity always incomplete?</h2>
			</BaseAnimationReveal>
			<BaseAnimationReveal
				className="mt-10"
				trigger="manual"
				shouldAnimate={animateDescription}
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
			</BaseAnimationReveal>
		</div>
	);
}
