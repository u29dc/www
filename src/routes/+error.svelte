<script lang="ts">
import LayoutContentBlock from '$lib/components/layout/LayoutContentBlock.svelte';
import LayoutSharedWrapper from '$lib/components/layout/LayoutSharedWrapper.svelte';
import { SITE } from '$lib/constants';

let { status }: { status: number } = $props();

const headline = $derived(status === 404 ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{status} — {SITE.title}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<LayoutSharedWrapper type="index">
	<LayoutContentBlock id="error" title="error" colSpanFull={false}>
		<div class="flex flex-col gap-6">
			<div class="font-mono text-xs tracking-[0.35em] opacity-60">
				Status {status}
			</div>
			<div class="font-xl uppercase my-40">{headline}</div>
		</div>
	</LayoutContentBlock>
</LayoutSharedWrapper>
