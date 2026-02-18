<script lang="ts">
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

<div class="text-[1.4rem] font-medium leading-[1.7] text-pretty">
	{@render children()}
</div>
