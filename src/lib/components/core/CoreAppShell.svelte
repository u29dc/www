<script lang="ts">
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

{@render children()}

<div class="grid-overlay" aria-hidden="true">
	<div class="grid-overlay-inner"></div>
</div>
