<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href: string;
		variant?: "ghost" | "solid";
		class?: string;
		children: Snippet;
	}

	let {
		href,
		variant = "ghost",
		class: className = "",
		children,
	}: Props = $props();

	const variantClasses = $derived(
		variant === "solid"
			? "bg-black text-white hover:bg-black/80"
			: "text-black/60 hover:bg-black/5 hover:text-black",
	);
</script>

<a
	{href}
	class="inline-flex min-h-[30px] items-center rounded-md px-3 font-mono text-[9px] transition-colors {variantClasses} {className}"
>
	{@render children()}
</a>
