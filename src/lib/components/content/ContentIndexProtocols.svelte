<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
import ContentIndexProtocolsItem from '$lib/components/content/ContentIndexProtocolsItem.svelte';
</script>

<div class="my-10 flex flex-col gap-8">
	<Animate stage="protocols" index={0} stagger={120} className="flex w-full flex-col gap-0 text-right font-mono">
		<div>Three protocols structure engagement. Each embodies the practice's</div>
		<div>core principle: discovery determines direction, not the reverse.</div>
		<div>MAP establishes territory. ARC builds the architecture.</div>
		<div>ADV maintains stewardship.</div>
	</Animate>

	<div class="grid-row-3 grid gap-y-6">
		<Animate stage="protocols" index={1} stagger={120}>
			<ContentIndexProtocolsItem
				title="MAP"
				subtitle="Discovery is work, not prelude to work."
				description="Seven to ten days mapping territory before choosing direction. Understanding what you're actually solving, not what you assume you're solving. Determines whether challenge warrants full engagement and what that engagement should look like. Credits toward ARC within 45 days. Required entry point."
				investment="£2,500-4,000"
				duration="7-10 days"
			/>
		</Animate>

		<Animate stage="protocols" index={2} stagger={120}>
			<ContentIndexProtocolsItem
				title="ARC"
				subtitle="Clarity enabling movement, not just understanding."
				description="For founders at inflection points where complexity paralyzes decision-making. Full narrative package: strategy + flagship artifact + implementation guidance. The 'architect' engagement—we define the direction AND prove it works with a north-star artifact internal teams can scale from. The outcome: movement forward with confidence, backed by tangible proof."
				investment="£25,000-60,000"
				duration="4-6 weeks"
			/>
		</Animate>

		<Animate stage="protocols" index={3} stagger={120}>
			<ContentIndexProtocolsItem
				title="ADV"
				subtitle="Sustained narrative stewardship through growth phases."
				description="Ongoing creative direction for clients who've been through ARC. 1-2 calls/month + async artifacts. We steward work we've already shaped—not available as standalone engagement."
				investment="£8,000-15,000/month"
				duration="3 months minimum"
			/>
		</Animate>
	</div>
</div>
