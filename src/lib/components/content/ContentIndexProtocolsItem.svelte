<script lang="ts">
type Props = {
	title: string;
	subtitle: string;
	description: string;
	investment: string;
	duration: string;
};

let { title, subtitle, description, investment, duration }: Props = $props();
</script>

<div class="relative flex h-[20rem] flex-col justify-between rounded-sm border border-current/10 p-4">
	<div>
		<div class="mb-2 font-bold text-2xl uppercase">{title}</div>
		<div class="opacity-80">{subtitle}</div>
	</div>
	<div>
		{#if description}
			<div class="mb-3 w-2/3 max-w-full">{description}</div>
		{/if}

		<div class="mt-6 flex justify-between text-lg opacity-50">
			<div>{duration}</div>
			<div>{investment}</div>
		</div>
	</div>
</div>
