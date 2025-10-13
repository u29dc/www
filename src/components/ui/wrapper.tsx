/**
 * Wrapper Component
 *
 * ## SUMMARY
 * Basic wrapper for main content sections.
 *
 * ## USAGE
 * ```tsx
 * <Wrapper>
 *   <FeedItem />
 * </Wrapper>
 * ```
 *
 * @module components/ui/wrapper
 */

import { BlurGradient } from '@/components/ui/blur-gradient';
import { Header } from '@/components/ui/header';
import type { WrapperProps } from '@/lib/types/components';

export function Wrapper({ type, children, frontmatter }: WrapperProps) {
	return (
		<main className="grid grid-cols-10 grid-rows-[15rem_auto_1fr] full-container min-h-screen">
			<section className="sticky top-0 col-start-1 col-span-full row-start-1 md:col-start-6 md:col-span-5 lg:col-start-6 lg:col-span-4">
				<BlurGradient position="top" size="15rem" fixed={false} strength={3} layers={10} />
				<div className="relative z-[1001] full-container">
					<Header type={type} frontmatter={frontmatter} />
				</div>
			</section>
			<section className="grid grid-cols-10 col-span-full row-start-2 space-y-2 md:space-y-5">
				{children}
			</section>
			<section className="col-span-full row-start-3 h-20"></section>
		</main>
	);
}
