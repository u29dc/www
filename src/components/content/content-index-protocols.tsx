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

				<div className="mt-6 text-lg opacity-50">
					{investment} | {duration}
				</div>
			</div>
		</AnimatedBlock>
	);
}

export function ContentIndexProtocols() {
	return (
		<div className="my-10 flex flex-col gap-8">
			{/* Introduction */}
			<div className="flex w-full flex-col gap-0 text-right font-mono">
				<AnimatedStaggerRedacted stageId="index-protocols-intro" className="">
					Incomplete Infinity operates through three connected protocols.
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro" className="">
					Every engagement begins with MAP. Each follows the same foundation:
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro" className="">
					Discover (interview, materials analysis, core challenge identification),
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro" className="">
					Create (research, design, production), and Deliver (complete work with
				</AnimatedStaggerRedacted>
				<AnimatedStaggerRedacted stageId="index-protocols-intro" className="">
					implementation guidance and revision round included).
				</AnimatedStaggerRedacted>
			</div>

			{/* Protocol Cards */}
			<div className="grid-row-3 grid gap-y-6">
				<ContentIndexProtocolsItem
					stageId="index-protocols-map"
					title="MAP"
					subtitle="Mapping the territory before choosing direction."
					description="Strategic foundations that prevent building the wrong thing well. Discovery that challenges assumptions before committing resources. Required first step for LAB and COM."
					investment="£2,000"
					duration="7 days"
				/>

				<ContentIndexProtocolsItem
					stageId="index-protocols-lab"
					title="LAB"
					subtitle="Creating language for climate and AI futures through public prototypes and inquiry frameworks."
					description="For organizations facing questions that lack existing vocabulary. Structure: inquiry framework + public prototype (format determined by research question) + briefing monograph + dissemination support."
					investment="£15,000-35,000"
					duration="4-8 weeks"
				/>

				<ContentIndexProtocolsItem
					stageId="index-protocols-com"
					title="COM"
					subtitle="Decision-adjacent outcomes for founders at critical inflection points."
					description="Translating complexity into clarity when choices matter—funding, partnerships, product direction. Narrative System: complete narrative architecture. Ongoing Partnership: sustained narrative stewardship."
					investment="£20,000-50,000"
					duration="2-4 weeks"
				/>
			</div>
		</div>
	);
}
