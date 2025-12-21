<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
import ContentIndexProtocolsItem from '$lib/components/content/ContentIndexProtocolsItem.svelte';

type Protocol = 'MAP' | 'ARC' | 'ADV';

let active: Protocol = $state('MAP');
let contentVisible = $state(true);
let isAnimating = $state(false);

const protocols = [
	{
		id: 'MAP' as Protocol,
		title: 'MAP',
		subtitle: 'Discovery is work, not prelude to work.',
		description:
			"Seven to ten days mapping territory before choosing direction. Understanding what you're actually solving, not what you assume you're solving. Determines whether challenge warrants full engagement and what that engagement should look like. Credits toward ARC within 45 days. Required entry point.",
		investment: '£2,500-4,000',
		duration: '7-10 days',
		pricePercent: 7,
	},
	{
		id: 'ARC' as Protocol,
		title: 'ARC',
		subtitle: 'Clarity enabling movement, not just understanding.',
		description:
			"For founders at inflection points where complexity paralyzes decision-making. Full narrative package: strategy + flagship artifact + implementation guidance. The 'architect' engagement—we define the direction AND prove it works with a north-star artifact internal teams can scale from. The outcome: movement forward with confidence, backed by tangible proof.",
		investment: '£25,000-60,000',
		duration: '4-6 weeks',
		pricePercent: 100,
	},
	{
		id: 'ADV' as Protocol,
		title: 'ADV',
		subtitle: 'Sustained narrative stewardship through growth phases.',
		description: "Ongoing creative direction for clients who've been through ARC. 1-2 calls/month + async artifacts. We steward work we've already shaped—not available as standalone engagement.",
		investment: '£8,000-15,000/mo',
		duration: '3 months+',
		pricePercent: 25,
	},
];

let gridColumns = $derived(active === 'MAP' ? '4fr 1fr 1fr' : active === 'ARC' ? '1fr 4fr 1fr' : '1fr 1fr 4fr');

function handleSelect(protocol: Protocol) {
	if (protocol === active || isAnimating) return;

	isAnimating = true;
	contentVisible = false;

	setTimeout(() => {
		active = protocol;
		setTimeout(() => {
			contentVisible = true;
			isAnimating = false;
		}, 300);
	}, 150);
}
</script>

<div class="my-10 flex flex-col gap-8">
	<Animate
		stage="protocols"
		index={0}
		stagger={120}
		className="flex w-full flex-col gap-0 text-right font-mono"
	>
		<div>
			Three protocols structure engagement. Each embodies the practice's
		</div>
		<div>
			core principle: discovery determines direction, not the reverse.
		</div>
		<div>MAP establishes territory. ARC builds the architecture.</div>
		<div>ADV maintains stewardship.</div>
	</Animate>

	<!-- Desktop: Horizontal grid with animated columns -->
	<div
		class="hidden h-[25rem] gap-4 md:grid"
		style="grid-template-columns: {gridColumns}; transition: grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1);"
	>
		{#each protocols as protocol, i}
			<Animate
				stage="protocols"
				index={i + 1}
				stagger={120}
				className="h-full"
			>
				<ContentIndexProtocolsItem
					title={protocol.title}
					subtitle={protocol.subtitle}
					description={protocol.description}
					investment={protocol.investment}
					duration={protocol.duration}
					expanded={active === protocol.id}
					contentVisible={active === protocol.id && contentVisible}
					pricePercent={protocol.pricePercent}
					onclick={() => handleSelect(protocol.id)}
				/>
			</Animate>
		{/each}
	</div>

	<!-- Mobile: Vertical accordion -->
	<div class="flex flex-col gap-4 md:hidden">
		{#each protocols as protocol, i}
			<Animate stage="protocols" index={i + 1} stagger={120}>
				<ContentIndexProtocolsItem
					title={protocol.title}
					subtitle={protocol.subtitle}
					description={protocol.description}
					investment={protocol.investment}
					duration={protocol.duration}
					expanded={active === protocol.id}
					contentVisible={active === protocol.id && contentVisible}
					pricePercent={protocol.pricePercent}
					onclick={() => handleSelect(protocol.id)}
				/>
			</Animate>
		{/each}
	</div>
</div>
