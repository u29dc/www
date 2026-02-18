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

<figure class="mdx-quote col-content-wide px-8 text-center">
	<blockquote
		class="font-serif text-[clamp(2rem,2.2vw,2.9rem)] leading-[1.28] text-balance italic font-bold"
	>
		{@render children()}
	</blockquote>

	{#if author || source || reference}
		<figcaption
			class="mt-[1.2rem] flex flex-wrap justify-center gap-2 font-mono text-[0.95rem] text-muted uppercase"
		>
			<span aria-hidden="true">—</span>
			{#if author}
				<span>{author}</span>
			{/if}
			{#if source}
				<span>{source}</span>
			{/if}
			{#if reference}
				{#if href}
					<a
						{href}
						class="underline underline-offset-[0.2rem] external-link-feedback"
					>
						{reference}
					</a>
				{:else}
					<span>{reference}</span>
				{/if}
			{/if}
		</figcaption>
	{/if}
</figure>
