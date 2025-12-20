<script lang="ts">
import { ArrowUpRight } from 'lucide-svelte';
import type { Snippet } from 'svelte';

type Props = {
	title: string;
	description: string;
	link: string;
	children?: Snippet;
};

let { title, description, link, children }: Props = $props();
</script>

<a
	href={link}
	target="_blank"
	rel="noopener noreferrer"
	class="group mb-4 flex flex-row justify-between gap-2 py-6 transition duration-200 hover:bg-white hover:text-black"
>
	<div>
		<div class="uppercase">{title}</div>
		<div>{description}</div>
		{#if children}
			<div>
				{@render children()}
			</div>
		{/if}
	</div>
	<div class="transition-all duration-200 group-hover:mr-2">
		<ArrowUpRight size={12} />
	</div>
</a>
