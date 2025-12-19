<script lang="ts">
import ContentIndexArtifacts from '$lib/components/content/ContentIndexArtifacts.svelte';
import ContentIndexAxioms from '$lib/components/content/ContentIndexAxioms.svelte';
import ContentIndexProtocols from '$lib/components/content/ContentIndexProtocols.svelte';
import ContentIndexStatement from '$lib/components/content/ContentIndexStatement.svelte';
import LayoutContentBlock from '$lib/components/layout/LayoutContentBlock.svelte';
import LayoutSharedWrapper from '$lib/components/layout/LayoutSharedWrapper.svelte';
import { SITE } from '$lib/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{SITE.title}</title>
	<meta name="description" content={SITE.description} />
</svelte:head>

<LayoutSharedWrapper type="index">
    <LayoutContentBlock id="statement" title="statement" colSpanFull={false}>
		<ContentIndexStatement />
	</LayoutContentBlock>

	<div class="h-120"></div>

    <LayoutContentBlock id="artifacts" title="artifacts" colSpanFull={true}>
		<ContentIndexArtifacts items={data.artifacts} />
	</LayoutContentBlock>

	<div class="h-120"></div>

    <LayoutContentBlock id="axioms" title="axioms" colSpanFull={false}>
		<ContentIndexAxioms />
	</LayoutContentBlock>

	<div class="h-120"></div>

    <LayoutContentBlock id="protocols" title="protocols" colSpanFull={false}>
		<ContentIndexProtocols />
	</LayoutContentBlock>

	<div class="h-120"></div>
</LayoutSharedWrapper>
