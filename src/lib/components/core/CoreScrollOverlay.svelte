<script lang="ts">
type Props = {
	pageType: 'index' | 'article';
};

let { pageType }: Props = $props();

const isIndexPage = $derived(pageType === 'index');
const ctaHref = $derived(isIndexPage ? 'https://u29dc.co/hey' : '/');
const ctaLabel = $derived(isIndexPage ? 'BOOK A CALL ↗' : '← GO BACK');
const ctaTarget = $derived(isIndexPage ? '_blank' : undefined);
const ctaRel = $derived(isIndexPage ? 'noopener noreferrer' : undefined);
</script>

<div class="-translate-y-1/2 padding-standard pointer-events-none fixed top-1/2 left-0 z-20 h-[500px] w-full select-none">
	<div class="relative h-px w-full">
		<div class="absolute inset-0 origin-left bg-black"></div>
		<div class="pointer-events-auto absolute top-[1px] left-full md:left-[20%]">
			<a class="-m-2.5 inline-block p-2.5" href={ctaHref} target={ctaTarget} rel={ctaRel}>
				<div class="-translate-x-full whitespace-nowrap bg-black px-3 py-2 font-mono text-sm text-white md:-translate-x-1/2">
					{ctaLabel}
				</div>
			</a>
		</div>
	</div>
</div>
