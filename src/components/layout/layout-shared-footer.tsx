/**
 * Layout Shared Footer
 *
 * ## SUMMARY
 * Footer with social media and contact navigation links.
 *
 * ## RESPONSIBILITIES
 * - Render social media links with external link attributes
 *
 * @module components/layout/layout-shared-footer
 */

import { ArrowUpRight } from 'lucide-react';
import { AnimatedBlock } from '@/components/animation/animated-block';
import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';
import { AtomicBrandLogo } from '@/components/atomic/atomic-brand-logo';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { BUILD } from '@/lib/constants';

interface LayoutSharedFooterLinkProps {
	title: string;
	description: string;
	link: string;
	children?: React.ReactNode;
}

export function LayoutSharedFooterLink({
	title,
	description,
	link,
	children,
}: LayoutSharedFooterLinkProps) {
	return (
		<a
			href={link}
			target="_blank"
			rel="noopener noreferrer"
			className="mb-20 flex flex-row gap-2 justify-between"
		>
			<div className="">
				<div className="uppercase">{title}</div>
				<div className="">{description}</div>
				<div className="">{children}</div>
			</div>
			<div className="">
				<ArrowUpRight size={12} />
			</div>
		</a>
	);
}

export function LayoutSharedFooter() {
	return (
		<footer className="padding-standard grid grid-cols-10 w-full bg-black text-white">
			<AtomicGradientBlur position="bottom" size="10rem" fixed={true} />

			<AnimatedBlock
				stageId="layout-footer-nav"
				className="col-span-base row-start-2 xl:row-start-1 h-[100rem] max-h-[100vh] z-1001"
			>
				<div className="padding-standard px-0 flex flex-col gap-4 justify-between h-full">
					<div className="w-full grid grid-cols-2 gap-4">
						<LayoutSharedFooterLink
							title="Instagram"
							description="@u29dc"
							link="https://instagram.com/u29dc"
						/>

						<LayoutSharedFooterLink
							title="LinkedIn"
							description="u29dc"
							link="https://linkedin.com/in/u29dc"
						/>

						<LayoutSharedFooterLink
							title="Calendar"
							description="Let's meet"
							link="https://cal.com/u29dc/hey"
						>
							<AnimatedStaggerRedacted stageId="meta-annotation">
								<div className="annotation w-full md:w-[10vw]">
									[ At the intersection where established fields don't reach ]
								</div>
							</AnimatedStaggerRedacted>
						</LayoutSharedFooterLink>

						<LayoutSharedFooterLink
							title="EMAIL"
							description="hey@u29dc.com"
							link="mailto:hey@u29dc.com"
						>
							<AnimatedStaggerRedacted stageId="meta-annotation">
								<div className="annotation w-full md:w-[10vw]">
									[ Response time: 48 hours ]
								</div>
							</AnimatedStaggerRedacted>
						</LayoutSharedFooterLink>

						<div></div>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation w-full md:w-[10vw]">
								MAP, LAB, COM—three protocols, one foundation. Each begins with
								acknowledging what we don't yet know. Discovery isn't prelude to
								real work; it is the work.
							</div>
						</AnimatedStaggerRedacted>

						<div></div>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation flex flex-col gap-0 text-right">
								After-all isnt true_infinity *always*incomplete ?
							</div>
						</AnimatedStaggerRedacted>
					</div>

					<AtomicBrandLogo
						className="-translate-x-150"
						theme="dark"
						width={1000}
						defaultBlurIntensity={0.25}
						mouseBlurIntensity={0.4}
						noiseIntensity={0.1}
						noiseScale={1}
					/>

					<div className="w-full grid grid-cols-2 gap-4">
						<LayoutSharedFooterLink
							title="GitHub"
							description={BUILD.commitSha}
							link="https://github.com/u29dc/www"
						/>

						<div></div>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation w-full">
								[ "Man cannot endure his own littleness unless he can translate it
								into meaningfulness on the largest possible level" — Ernest Becker ]
							</div>
						</AnimatedStaggerRedacted>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation w-full text-right">U29DC is the attempt</div>
						</AnimatedStaggerRedacted>
					</div>
				</div>
			</AnimatedBlock>
		</footer>
	);
}
