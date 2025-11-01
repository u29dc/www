/**
 * Content Index Axioms
 *
 * ## SUMMARY
 * Homepage axioms content with timeline-coordinated AnimatedStagger animations.
 *
 * ## RESPONSIBILITIES
 * - Render axioms title and three axiom blocks with sequential AnimatedStagger stages
 *
 * @module components/content/content-index-axioms
 */

import { AnimatedBlock } from '@/components/animation/animated-block';

interface ContentIndexAxiomsItemProps {
	stageId: string;
	id: number;
	title: string;
	quote: string;
	description: string;
}

export function ContentIndexAxiomsItem({
	stageId,
	id,
	title,
	quote,
	description,
}: ContentIndexAxiomsItemProps) {
	return (
		<AnimatedBlock
			stageId={stageId}
			className="border border-current/10 rounded-sm p-4 h-[20rem] flex flex-col justify-between relative"
		>
			<div className=" z-2">
				<div className="uppercase">{title}</div>
			</div>
			<div className="z-2 max-w-full w-2/3">
				<div>{quote}</div>
				<div>{description}</div>
				<div className="font-mono absolute right-2 bottom-2 md:right-4 md:bottom-4">
					{id.toString().padStart(3, '0')}
				</div>
			</div>
		</AnimatedBlock>
	);
}

export function ContentIndexAxioms() {
	return (
		<div className="grid grid-row-3 gap-4">
			<ContentIndexAxiomsItem
				stageId="index-axioms-imperfect"
				id={1}
				title="Imperfect"
				quote='"In all chaos, there is a cosmos." – Carl Jung'
				description="There's a quiet beauty in what's broken, a hidden rhythm in disorder. Perfection smooths over the edges, but it's the cracks that let the light through."
			/>
			<ContentIndexAxiomsItem
				stageId="index-axioms-inexplicable"
				id={2}
				title="Inexplicable"
				quote='"Art steps from the obvious toward the concealed." – Khalil Gibran'
				description="Art lives in the shadows, between what is seen and what is felt. It's an echo that lingers, a riddle without an answer."
			/>
			<ContentIndexAxiomsItem
				stageId="index-axioms-incomplete"
				id={3}
				title="Incomplete"
				quote='"Art is not what you see, but what you make others see." – Edgar Degas'
				description="A creation is never whole on its own. It waits, suspended, until you step into the frame. Viewers gaze completes the story; their thoughts fill the silence."
			/>
		</div>
	);
}
