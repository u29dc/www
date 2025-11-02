/**
 * Content Index Statement
 *
 * ## SUMMARY
 * Homepage statement content with timeline-coordinated AnimatedReveal word animations.
 *
 * ## RESPONSIBILITIES
 * - Render intro and description with sequential AnimatedReveal stages
 *
 * @module components/content/content-index
 */

import { AnimatedBlock } from '@/components/animation/animated-block';
import { AnimatedStaggerBlur } from '@/components/animation/animated-stagger-blur';
import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';

export function ContentIndexStatement() {
	return (
		<div className="h-[50vh] flex flex-col gap-10">
			<AnimatedBlock stageId="index-statement-title" className="mb-10">
				<h1>
					<span className="w-full flex justify-between">
						<span>An evolving, enigmatic,</span>
						<span>multifaceted</span>
					</span>
					<span className="w-full flex justify-between">
						<span>creative practice</span>
						<span>—</span>
						<span>turning</span>
						<span>complex futures into</span>
					</span>
					<span className="w-full flex justify-between">
						<span>decision grade narratives.</span>
					</span>
				</h1>
			</AnimatedBlock>
			<AnimatedStaggerBlur stageId="index-statement-description" className="mb-0">
				<div>It inhabits the space between what is seen and what is felt.</div>
				<div>It operates in the deliberate pause, dwells in the charged moment.</div>
				<div>It expresses itself... in incomplete form.</div>
				<div>After all, isn't true infinity always incomplete?</div>
			</AnimatedStaggerBlur>

			<AnimatedStaggerBlur stageId="index-statement-description" className="mb-0">
				<div>
					The practice questions premises before refining execution. Asks "why not
					differently?" because the most interesting possibilities emerge not from
					optimization, but from questioning the premise entirely. The work moves between
					LAB (speculative research, public prototypes, new frames for understanding) and
					COM (strategic narrative, decision-grade artifacts for organizations navigating
					complexity). Research generates language; commerce deploys it. Each feeds the
					other, operating in the productive tension between chaos and order, between the
					mapped and the undiscovered.
				</div>
			</AnimatedStaggerBlur>

			<AnimatedStaggerRedacted stageId="meta-annotation">
				<div className="annotation w-full md:w-[10vw]">
					* these positions emerged from questioning what strategic narrative could be
					beyond marketing ⊞⊞⊞
				</div>
			</AnimatedStaggerRedacted>

			<AnimatedStaggerRedacted stageId="meta-annotation" className="self-end line-through">
				<div className="annotation w-[35vw] md:w-[10vw]">[ thinking in intersections ]</div>
			</AnimatedStaggerRedacted>
		</div>
	);
}
