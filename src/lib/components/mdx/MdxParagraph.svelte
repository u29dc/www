<script lang="ts">
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<div class="padding-standard grid grid-cols-10">
	<div class="col-span-base">
		{@render children()}
	</div>
</div>
