/**
 * Content Index Protocols
 *
 * ## SUMMARY
 * Homepage protocols content with timeline-coordinated AnimatedStagger animations.
 *
 * ## RESPONSIBILITIES
 * - Render protocols introduction and three protocol cards (MAP, LAB, COM) with sequential AnimatedStagger stages
 *
 * @module components/content/content-index-protocols
 */

import { AnimatedBlock } from '@/components/animation/animated-block';
import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';

interface ContentIndexProtocolsItemProps {
	stageId: string;
	title: string;
	subtitle: string;
	description: string;
	investment: string;
	duration: string;
}

export function ContentIndexProtocolsItem({
	stageId,
	title,
	subtitle,
	description,
	investment,
	duration,
}: ContentIndexProtocolsItemProps) {
	return (
		<AnimatedBlock
			stageId={stageId}
			className="relative flex h-[20rem] flex-col justify-between rounded-sm border border-current/10 p-4"
		>
			<div>
				<div className="mb-2 font-bold text-2xl uppercase">{title}</div>
				<div className="opacity-80">{subtitle}</div>
			</div>
			<div>
				{description && <div className="mb-3 w-2/3 max-w-full">{description}</div>}

				<div className="mt-6 flex justify-between text-lg opacity-50">
					<div className="">{duration}</div>
					<div className="">{investment}</div>
				</div>
			</div>
		</AnimatedBlock>
	);
}

export function ContentIndexProtocols() {
	return (
		<div className="my-10 flex flex-col gap-8">
			<div className="flex w-full flex-col gap-0 text-right font-mono">
				<AnimatedStaggerRedacted stageId="index-protocols-intro">
					Three protocols structure engagement. Each embodies the practice's
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro">
					core principle: discovery determines direction, not the reverse.
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro">
					MAP establishes territory. LAB creates language where vocabulary
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro">
					doesn't exist. COM deploys clarity where decisions demand it.
				</AnimatedStaggerRedacted>
			</div>

			<div className="grid-row-3 grid gap-y-6">
				<ContentIndexProtocolsItem
					stageId="index-protocols-map"
					title="MAP"
					subtitle="Discovery is work, not prelude to work."
					description="Seven days mapping territory before choosing direction. Understanding what you're actually solving, not what you assume you're solving. Determines whether challenge requires creating new language or deploying existing clarity. Credits toward LAB or COM—required entry point for both."
					investment="£2,000"
					duration="7 days"
				/>

				<ContentIndexProtocolsItem
					stageId="index-protocols-lab"
					title="LAB"
					subtitle="Creating vocabulary where none exists."
					description="For organizations confronting futures that resist existing frameworks. Inquiry generates prototypes—whether film, installation, or interactive system—that make abstract complexity tangible. The outcome: language that travels beyond initial context, frameworks others adopt."
					investment="£15,000-30,000"
					duration="4-8 weeks"
				/>

				<ContentIndexProtocolsItem
					stageId="index-protocols-com"
					title="COM"
					subtitle="Clarity enabling movement, not just understanding."
					description="For founders at inflection points where complexity paralyzes decision-making. Compressing futures into decision-grade narrative—not simplification, but synthesis that preserves necessary complexity while enabling action. The outcome: movement forward with confidence."
					investment="£20,000-60,000"
					duration="2-4 weeks"
				/>
			</div>
		</div>
	);
}
