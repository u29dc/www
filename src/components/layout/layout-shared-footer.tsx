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
import type { ReactNode } from 'react';
import { AnimatedBlock } from '@/components/animation/animated-block';
import { AnimatedStaggerRedacted } from '@/components/animation/animated-stagger-redacted';
import { AtomicBrandLogo } from '@/components/atomic/atomic-brand-logo';
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { BUILD } from '@/lib/constants';

interface LayoutSharedFooterLinkProps {
	title: string;
	description: string;
	link: string;
	children?: ReactNode;
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
			className="group mb-4 flex flex-row justify-between gap-2 py-6 transition duration-200 hover:bg-white hover:text-black"
		>
			<div className="">
				<div className="uppercase">{title}</div>
				<div className="">{description}</div>
				<div className="">{children}</div>
			</div>
			<div className="transition-all duration-200 group-hover:mr-2">
				<ArrowUpRight size={12} />
			</div>
		</a>
	);
}

export function LayoutSharedFooter() {
	return (
		<footer className="padding-standard grid h-fit min-h-screen w-full grid-cols-10 bg-black text-white">
			<AtomicGradientBlur position="bottom" size="10rem" fixed={true} />

			<AnimatedBlock
				stageId="layout-footer-nav"
				className="z-1001 col-span-base row-start-1 h-full"
			>
				<div className="padding-standard flex h-full flex-col justify-between gap-4 px-0">
					<div className="grid w-full grid-cols-2 gap-4">
						<LayoutSharedFooterLink
							title="Calendar"
							description="Let's meet"
							link="https://cal.com/u29dc/hey"
						>
							<AnimatedStaggerRedacted stageId="meta-annotation">
								<div className="w-full font-mono md:w-[10vw]">
									[ Always open to conversations that question premises, not just
									solve within them ]
								</div>
							</AnimatedStaggerRedacted>
						</LayoutSharedFooterLink>
						<LayoutSharedFooterLink
							title="EMAIL"
							description="hey@u29dc.com"
							link="mailto:hey@u29dc.com"
						>
							<AnimatedStaggerRedacted stageId="meta-annotation">
								<div className="w-full font-mono md:w-[10vw]">
									[ Response time: 48 hours ]
								</div>
							</AnimatedStaggerRedacted>
						</LayoutSharedFooterLink>

						<div className="col-span-2 h-20"></div>

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
							title="GitHub"
							description=""
							link="https://github.com/u29dc/www"
						>
							<AnimatedStaggerRedacted stageId="meta-annotation">
								<div className="w-full font-mono md:w-[10vw]">
									{BUILD.commitSha}
								</div>
							</AnimatedStaggerRedacted>
						</LayoutSharedFooterLink>
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

					<div className="grid w-full grid-cols-2 gap-4 font-mono">
						<div className="font-handwritten">
							After all, isn't true infinity always incomplete?
						</div>
					</div>
				</div>
			</AnimatedBlock>
		</footer>
	);
}
