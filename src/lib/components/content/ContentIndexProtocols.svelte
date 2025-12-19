<script lang="ts">
import ContentIndexProtocolsItem from '$lib/components/content/ContentIndexProtocolsItem.svelte';
</script>

<div class="my-10 flex flex-col gap-8">
	<div class="flex w-full flex-col gap-0 text-right font-mono">
		<div>Three protocols structure engagement. Each embodies the practice's</div>
		<div>core principle: discovery determines direction, not the reverse.</div>
		<div>MAP establishes territory. LAB creates language where vocabulary</div>
		<div>doesn't exist. COM deploys clarity where decisions demand it.</div>
	</div>

	<div class="grid-row-3 grid gap-y-6">
		<ContentIndexProtocolsItem
			title="MAP"
			subtitle="Discovery is work, not prelude to work."
			description="Seven days mapping territory before choosing direction. Understanding what you're actually solving, not what you assume you're solving. Determines whether challenge requires creating new language or deploying existing clarity. Credits toward LAB or COM—required entry point for both."
			investment="£2,000"
			duration="7 days"
		/>

		<ContentIndexProtocolsItem
			title="LAB"
			subtitle="Creating vocabulary where none exists."
			description="For organizations confronting futures that resist existing frameworks. Inquiry generates prototypes—whether film, installation, or interactive system—that make abstract complexity tangible. The outcome: language that travels beyond initial context, frameworks others adopt."
			investment="£15,000-30,000"
			duration="4-8 weeks"
		/>

		<ContentIndexProtocolsItem
			title="COM"
			subtitle="Clarity enabling movement, not just understanding."
			description="For founders at inflection points where complexity paralyzes decision-making. Compressing futures into decision-grade narrative—not simplification, but synthesis that preserves necessary complexity while enabling action. The outcome: movement forward with confidence."
			investment="£20,000-60,000"
			duration="2-4 weeks"
		/>
	</div>
</div>
