<script lang="ts">
	import type { Snippet } from "svelte";

	type Props = {
		author?: string;
		source?: string;
		reference?: string;
		href?: string;
		children: Snippet;
	};

	let { author, source, reference, href, children }: Props = $props();
</script>

<figure class="mdx-quote">
	<blockquote>
		{@render children()}
	</blockquote>

	{#if author || source || reference}
		<figcaption>
			<span aria-hidden="true">—</span>
			{#if author}
				<span>{author}</span>
			{/if}
			{#if source}
				<span>{source}</span>
			{/if}
			{#if reference}
				{#if href}
					<a {href}>{reference}</a>
				{:else}
					<span>{reference}</span>
				{/if}
			{/if}
		</figcaption>
	{/if}
</figure>
