<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		href: string;
		variant?: "ghost" | "solid";
		class?: string;
		"aria-current"?:
			| "page"
			| "step"
			| "location"
			| "date"
			| "time"
			| undefined;
		children: Snippet;
	}

	let {
		href,
		variant = "ghost",
		class: className = "",
		"aria-current": ariaCurrent,
		children,
	}: Props = $props();

	const variantClasses = $derived(
		variant === "solid"
			? "bg-contrast [filter:brightness(1)] hover-contrast-dim"
			: "text-foreground/60 hover-bg-subtle hover-text-solid",
	);
</script>

<a
	{href}
	class="inline-flex min-h-[30px] items-center rounded-md px-3 font-mono font-xs transition-colors focus-ring pressed-state aria-[current=page]:text-foreground {variantClasses} {className}"
	aria-current={ariaCurrent}
>
	{@render children()}
</a>
