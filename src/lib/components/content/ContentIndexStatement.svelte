<script lang="ts">
import Animate from '$lib/components/animation/Animate.svelte';
</script>

<div class="my-10 flex flex-col gap-10 font-md">
	<div class="uppercase">
		<h1>
			An evolving, enigmatic, multifaceted creative practice — turning
			complex futures into decision grade narratives.
		</h1>
	</div>
</div>

<div class="my-10 flex flex-col gap-8 font-mono">
	<Animate stage="statement" index={0} stagger={120}>
		<div>Imperfect.</div>
		<div>Inexplicable.</div>
		<div>Incomplete.</div>
	</Animate>

	<Animate stage="statement" index={1} stagger={120}>
		<div>These shape everything that follows.</div>
	</Animate>

	<Animate stage="statement" index={2} stagger={120}>
		<div>We turn complex futures into decision-grade narratives.</div>
	</Animate>

	<Animate stage="statement" index={3} stagger={120}>
		<div class="ml-auto w-9/10">
			<div>Where others see boundaries—</div>
		</div>
		<div class="ml-auto w-8/10">
			<div>strategy,</div>
			<div>design—</div>
			<div>film,</div>
			<div>architecture,</div>
			<div>code,</div>
		</div>
		<div class="ml-auto w-9/10">
			<div>we see continuous territory.</div>
		</div>
	</Animate>

	<Animate stage="statement" index={4} stagger={120}>
		<div class="ml-auto w-19/20">
			<div>The work inhabits intersections.</div>
		</div>
		<div class="ml-auto w-9/10">
			<div>Where compression fails.</div>
			<div>Where division destroys solutions.</div>
			<div>Where specialists refer problems elsewhere.</div>
		</div>
	</Animate>

	<Animate stage="statement" index={5} stagger={120}>
		<div>Strategic incompleteness is our method.</div>
		<div>Discovery determines form.</div>
		<div>Premises questioned before execution begins.</div>
	</Animate>

	<Animate stage="statement" index={6} stagger={120}>
		<div>After all, isn't true infinity always incomplete?</div>
	</Animate>

	<Animate stage="statement" index={7} stagger={120}>
		<div class="w-[35vw] font-handwritten md:w-[10vw]">
			Incomplete Infinity
		</div>
	</Animate>
</div>
