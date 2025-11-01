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
import { AtomicGradientBlur } from '@/components/atomic/atomic-gradient-blur';
import { BUILD } from '@/lib/constants';

interface LayoutSharedFooterLinkProps {
	title: string;
	description: string;
	link: string;
}

export function LayoutSharedFooterLink({ title, description, link }: LayoutSharedFooterLinkProps) {
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
				className="col-span-base h-[100rem] max-h-[100vh] z-1001"
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
						/>
						<LayoutSharedFooterLink
							title="GitHub"
							description={BUILD.commitSha}
							link="https://github.com/u29dc/www"
						/>
					</div>
					<div className="w-full grid grid-cols-2 gap-4">
						<LayoutSharedFooterLink
							title="EMAIL"
							description="hey@u29dc.com"
							link="mailto:hey@u29dc.com"
						/>
					</div>
				</div>
			</AnimatedBlock>
		</footer>
	);
}
