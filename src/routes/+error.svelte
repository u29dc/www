<script lang="ts">
import LayoutContentBlock from '$lib/components/layout/LayoutContentBlock.svelte';
import LayoutSharedWrapper from '$lib/components/layout/LayoutSharedWrapper.svelte';
import { SITE } from '$lib/constants';

let { status, error }: { status: number; error: App.Error } = $props();

const headline = $derived(status === 404 ? 'Page not found' : 'Something went wrong');
const message = $derived(error?.message ?? 'An unexpected error occurred.');
</script>

<svelte:head>
    <title>{status} — {SITE.title}</title>
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<LayoutSharedWrapper type="index">
    <LayoutContentBlock id="error" title="error" colSpanFull={false}>
        <div class="flex flex-col gap-6">
            <div class="font-mono text-xs uppercase tracking-[0.35em] opacity-60">Status {status}</div>
            <div class="font-xl uppercase">{headline}</div>
            <p class="max-w-[36rem] opacity-75">{message}</p>
            <div class="flex flex-wrap gap-3">
                <a class="rounded-sm border border-current/20 px-4 py-2 text-xs uppercase tracking-[0.35em]" href="/">Return home</a>
                <a class="rounded-sm border border-current/20 px-4 py-2 text-xs uppercase tracking-[0.35em]" href="/sitemap.xml">
                    Sitemap
                </a>
            </div>
        </div>
    </LayoutContentBlock>
</LayoutSharedWrapper>
