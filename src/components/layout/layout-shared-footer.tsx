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
			className="group mb-4 py-6 flex flex-row gap-2 justify-between transition duration-200 hover:bg-white hover:text-black"
		>
			<div className="">
				<div className="uppercase">{title}</div>
				<div className="">{description}</div>
				<div className="">{children}</div>
			</div>
			<div className="group-hover:mr-2 transition-all duration-200">
				<ArrowUpRight size={12} />
			</div>
		</a>
	);
}

export function LayoutSharedFooter() {
	return (
		<footer className="padding-standard grid grid-cols-10 w-full bg-black h-fit min-h-screen text-white">
			<AtomicGradientBlur position="bottom" size="10rem" fixed={true} />

			<AnimatedBlock
				stageId="layout-footer-nav"
				className="col-span-base row-start-1 z-1001 h-full"
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

						<div className="h-20 col-span-2"></div>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation w-full md:w-[10vw]">
								MAP, LAB, COM—three protocols, one foundation. Each begins with
								acknowledging what we don't yet know. Discovery isn't prelude to
								real work; it is the work.
							</div>
						</AnimatedStaggerRedacted>

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

					<div className="w-full grid grid-cols-2 gap-4 font-mono">
						<LayoutSharedFooterLink
							title="Source"
							description={BUILD.commitSha}
							link="https://github.com/u29dc/www"
						/>

						<div className="h-20 col-span-2"></div>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation">
								[ "Man cannot endure his own littleness unless he can translate it
								into meaningfulness on the largest possible level" — Ernest Becker ]
							</div>
						</AnimatedStaggerRedacted>

						<AnimatedStaggerRedacted stageId="meta-annotation">
							<div className="annotation w-full text-right">__U29DC__</div>
						</AnimatedStaggerRedacted>
					</div>
				</div>
			</AnimatedBlock>
		</footer>
	);
}
