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
import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';

export function ContentIndexStatement() {
	return (
		<div className="my-10 flex flex-col gap-10 font-md">
			<AnimatedBlock stageId="index-statement-title" className="uppercase">
				<h1>
					An evolving, enigmatic, multifaceted creative practice — turning complex futures
					into decision grade narratives.
				</h1>
			</AnimatedBlock>

			<AnimatedBlock stageId="index-statement-problem" className="mb-0">
				<div>
					Complex problems are typically addressed by first compressing them into familiar
					frameworks, then dividing them among specialists. Define the challenge. Identify
					which experts are needed. Assign components to each. Coordinate outputs into
					deliverables—elevator pitches, brand positioning statements, predetermined
					artifacts.
				</div>
				<br />
				<div>
					This succeeds when problems respect disciplinary boundaries and fit established
					categories.
				</div>
				<br />
				<div>
					It fails when the solution lives in the intersection—when territories must
					inform each other from the beginning, not converge at the end. When the
					challenge itself resists compression and demands synthesis rather than
					simplification. These problems require working across domains from the start,
					not coordinating specialists after division.
				</div>
			</AnimatedBlock>

			<AnimatedBlock stageId="index-statement-approach" className="mb-0">
				<div>
					This demands different assumptions. Incompleteness as strategy, not failure.
					Discovery determining form, not following templates. Premises questioned before
					execution begins.
				</div>
				<br />
				<div>
					The practice itself embodies this duality—creating language for futures while
					deploying clarity for present decisions. Speculative frameworks tested against
					strategic reality. Strategic challenges revealing territories requiring new
					inquiry. The work exists in the productive tension between research and
					application, each mode making the other possible.
				</div>
			</AnimatedBlock>

			<AnimatedBlock stageId="index-statement-essence" className="mb-0">
				<div>
					The work inhabits the space between what is seen and what is felt. It operates
					in the deliberate pause, dwells in the charged moment. It expresses itself in
					incomplete form—because strategic incompleteness rewards interpretation, invites
					completion through engagement.
				</div>
				<br />
				<div>After all, isn't true infinity always incomplete?</div>
			</AnimatedBlock>

			<AnimatedBlock stageId="index-statement-signature">
				<div className="w-[35vw] font-handwritten md:w-[10vw]">Incomplete Infinity</div>
			</AnimatedBlock>

			<div className="mt-40">
				<div className="float-right">
					<AnimatedStaggerRedacted stageId="meta-annotation">
						<div className="w-full text-right font-mono md:w-[10vw]">
							complexity accelerates faster than disciplines evolve vocabularies for
							it— the widening gap between what fields can articulate and what
							problems demand is where this practice lives deliberately
						</div>
					</AnimatedStaggerRedacted>
				</div>
			</div>
		</div>
	);
}
