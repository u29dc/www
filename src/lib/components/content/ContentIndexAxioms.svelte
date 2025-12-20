<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
import ContentIndexAxiomsItem from '$lib/components/content/ContentIndexAxiomsItem.svelte';
</script>

<div class="grid-row-4 my-10 grid gap-y-4">
	<Animate
		stage="axioms"
		index={0}
		stagger={120}
		className="flex w-full flex-col gap-0 font-mono md:w-1/3"
	>
		<div>█▓▒ Three axioms form the architecture of our thinking.</div>
		<div>They shaped the studio from its inception—informing</div>
		<div>
			our name, visual language, and protocols. More importantly, they
			shape how
		</div>
		<div>we approach every engagement:</div>
		<div>
			what questions we ask, what frameworks we build, what narratives we
			create.
		</div>
		<div>
			These are not principles we aspire to. They are the ground we build
			from. [³]
		</div>
	</Animate>

	<Animate
		stage="axioms"
		index={1}
		stagger={120}
		className="flex w-full justify-end"
	>
		<div class="mb-10 text-right font-mono">[*]</div>
	</Animate>

	<Animate stage="axioms" index={2} stagger={120}>
		<ContentIndexAxiomsItem
			id={1}
			title="Imperfect"
			quote="'In all chaos, there is a cosmos.' – Carl Jung"
			description="There's a quiet beauty in what's broken, a hidden rhythm in disorder. Perfection smooths over the edges, but it's the cracks that let the light through."
		/>
	</Animate>
	<Animate stage="axioms" index={3} stagger={120}>
		<ContentIndexAxiomsItem
			id={2}
			title="Inexplicable"
			quote="'Art steps from the obvious toward the concealed.' – Khalil Gibran"
			description="Art lives in the shadows, between what is seen and what is felt. It's an echo that lingers, a riddle without an answer."
		/>
	</Animate>
	<Animate stage="axioms" index={4} stagger={120}>
		<ContentIndexAxiomsItem
			id={3}
			title="Incomplete"
			quote="'Art is not what you see, but what you make others see.' – Edgar Degas"
			description="A creation is never whole on its own. It waits, suspended, until you step into the frame. Viewers gaze completes the story; their thoughts fill the silence."
		/>
	</Animate>
</div>
