<script lang="ts">
type Props = {
	title: string;
	subtitle: string;
	description: string;
	investment: string;
	duration: string;
	expanded: boolean;
	contentVisible: boolean;
	pricePercent: number;
	onclick: () => void;
};

let { title, subtitle, description, investment, duration, expanded, contentVisible, pricePercent, onclick }: Props = $props();
</script>

<button
	type="button"
	class="relative flex h-full w-full flex-col overflow-hidden rounded-sm border p-4 text-left transition-[border-color] duration-300 {expanded
		? 'border-current/20'
		: 'cursor-pointer border-current/10 hover:border-current/15'}"
	onclick={() => !expanded && onclick()}
	aria-expanded={expanded}
>
	<!-- Title - always visible, never fades -->
	<div class="mb-2 font-bold text-lg uppercase">{title}</div>

	<!-- Content area - both layers always absolute for stable height -->
	<div class="relative flex-1">
		<!-- Height reference: in document flow, invisible, determines card height on mobile -->
		<div
			class="invisible flex flex-col justify-between md:hidden"
			aria-hidden="true"
		>
			{#if expanded}
				<div>
					<div class="mb-3">{subtitle}</div>
					{#if description}
						<div>{description}</div>
					{/if}
				</div>
				<div class="pt-4">
					<div class="mb-2">{investment}</div>
					<div class="mb-3 h-1"></div>
					<div class="font-mono">{duration}</div>
				</div>
			{:else}
				<div>
					<div class="mb-2">{investment}</div>
					<div class="mb-3 h-1"></div>
					<div class="font-mono">{duration}</div>
				</div>
			{/if}
		</div>

		<!-- Expanded content - always absolute, visibility via opacity -->
		<div
			class="absolute inset-0 flex flex-col justify-between transition-opacity duration-200 {expanded &&
			contentVisible
				? 'opacity-100'
				: 'pointer-events-none opacity-0'}"
		>
			<div>
				<div class="mb-3 opacity-80">{subtitle}</div>
				{#if description}
					<div>{description}</div>
				{/if}
			</div>
			<div class="mt-auto pt-4">
				<div class="mb-2">{investment}</div>
				<div
					class="mb-3 h-1 bg-current/20"
					style="width: {pricePercent}%"
				></div>
				<div class="font-mono opacity-50">{duration}</div>
			</div>
		</div>

		<!-- Collapsed content - always absolute, visibility via opacity -->
		<div
			class="absolute inset-0 flex flex-col justify-end transition-opacity duration-200 {!expanded
				? 'opacity-100'
				: 'pointer-events-none opacity-0'}"
		>
			<div>
				<div class="mb-2">{investment}</div>
				<div
					class="mb-3 h-1 bg-current/20"
					style="width: {pricePercent}%"
				></div>
				<div class="font-mono opacity-50">{duration}</div>
			</div>
		</div>
	</div>
</button>
