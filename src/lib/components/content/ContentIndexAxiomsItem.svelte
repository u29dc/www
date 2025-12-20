<script lang="ts">
type Props = {
	id: number;
	title: string;
	quote: string;
	description: string;
};

let { id, title, quote, description }: Props = $props();
</script>

<div class="relative flex h-[20rem] flex-col justify-between rounded-sm border border-current/10 p-4">
	<div class="z-2">
		<div class="uppercase">{title}</div>
	</div>
	<div class="z-2 w-2/3 max-w-full">
		<div>{quote}</div>
		<div>{description}</div>
		<div class="absolute right-2 bottom-2 font-mono md:right-4 md:bottom-4">
			{id.toString().padStart(3, '0')}
		</div>
	</div>
</div>
