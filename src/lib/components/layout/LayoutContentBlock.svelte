<script lang="ts">
import type { Snippet } from 'svelte';

type Props = {
	id: string | number;
	title: string;
	colSpanFull?: boolean;
	className?: string;
	children: Snippet;
};

let { id, title, colSpanFull = false, className = '', children }: Props = $props();
</script>

<div
	data-id={id}
	data-title={title}
	class={`padding-standard marker-all grid grid-cols-10 py-0 ${className}`}
>
	<div class="-col-end-1 col-span-base col-start-1 row-start-1 font-mono sm:col-start-1 md:col-start-3 lg:col-start-4 xl:col-start-5 2xl:col-start-6 3xl:col-start-7">
		<div class="mb-10 select-none rounded-sm border-current/10 text-right md:mb-5 md:text-left">
			<div>[ {title.toUpperCase()} ]</div>
		</div>
	</div>
	<div class={`${colSpanFull ? 'col-span-full' : 'col-span-base'} row-start-2 md:row-start-1`}>
		{@render children()}
	</div>
</div>
