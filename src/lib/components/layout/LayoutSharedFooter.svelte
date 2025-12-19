<script lang="ts">
import AtomicBrandLogo from '$lib/components/atomic/AtomicBrandLogo.svelte';
import AtomicGradientBlur from '$lib/components/atomic/AtomicGradientBlur.svelte';
import LayoutSharedFooterLink from '$lib/components/layout/LayoutSharedFooterLink.svelte';
import { BUILD } from '$lib/constants';
</script>

<footer class="padding-standard grid h-fit min-h-screen w-full select-none grid-cols-10 bg-black text-white uppercase">
	<AtomicGradientBlur position="bottom" size="10rem" fixed={true} />

	<div class="relative z-10 col-span-base row-start-1 h-full">
		<div class="padding-standard flex h-full flex-col justify-between gap-4 px-0">
			<div class="grid w-full grid-cols-2 gap-4">
				<LayoutSharedFooterLink title="Calendar" description="Let's meet" link="https://u29dc.co/hey">
					<div class="font-mono">
						[ Always open to conversations that question premises, not just solve within them ]
					</div>
				</LayoutSharedFooterLink>
				<LayoutSharedFooterLink title="EMAIL" description="hey@u29dc.com" link="mailto:hey@u29dc.com">
					<div class="font-mono">[ Response time: 48 hours ]</div>
				</LayoutSharedFooterLink>
				<div class="col-span-2 h-20"></div>
				<LayoutSharedFooterLink title="Instagram" description="@u29dc" link="https://instagram.com/u29dc" />
				<LayoutSharedFooterLink title="LinkedIn" description="u29dc" link="https://linkedin.com/in/u29dc" />
				<LayoutSharedFooterLink title="GitHub" description="" link="https://github.com/u29dc/www">
					<div class="font-mono">{BUILD.commitSha}</div>
				</LayoutSharedFooterLink>
			</div>

			<AtomicBrandLogo className="-translate-x-150" width={1000} />

			<div class="grid w-full grid-cols-2 gap-4 font-mono">
				<div class="font-handwritten">After all, isn't true infinity always incomplete?</div>
			</div>
		</div>
	</div>
</footer>
