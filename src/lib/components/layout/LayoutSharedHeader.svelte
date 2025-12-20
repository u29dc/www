<script lang="ts">
import AtomicBrandLogo from '$lib/components/atomic/AtomicBrandLogo.svelte';
import AtomicGradientBlur from '$lib/components/atomic/AtomicGradientBlur.svelte';
import { SITE } from '$lib/constants';
import type { ContentItem } from '$lib/content-types';

type Props = {
	type: 'index' | 'article';
	frontmatter?: ContentItem;
	title?: string;
};

let { type, frontmatter, title }: Props = $props();

const fallbackTitle = SITE.title;
const headingContent = $derived(type === 'article' ? (frontmatter?.title ?? title ?? fallbackTitle) : (title ?? fallbackTitle));
</script>

<div class="padding-standard grid h-60 grid-cols-10">
	<header class="col-span-base">
		<AtomicGradientBlur position="top" size="15rem" fixed={true} layers={5} className="z-0" />

		<div class="full-container relative z-10 uppercase">
			<div class="-translate-x-1/2 absolute bottom-0 left-1/2 w-full text-center">
				<div>{headingContent}</div>
			</div>
			<nav class="absolute bottom-0 left-0">
				<AtomicBrandLogo className="-translate-x-30 translate-y-6" />
			</nav>
		</div>
	</header>
</div>
