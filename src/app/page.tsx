/**
 * Home Page
 *
 * ## SUMMARY
 * Displays chronological feed of all content items.
 *
 * ## RESPONSIBILITIES
 * - Fetch all content via aggregator
 * - Render site header
 * - Map content items to feed components
 *
 * ## USAGE
 * ```tsx
 * // Automatic Next.js route at /
 * ```
 *
 * @module app/page
 */

import Link from 'next/link';

import { FeedItem } from '@/components/ui/feed-item';
import { Wrapper } from '@/components/ui/wrapper';
import { getFeedContent } from '@/lib/mdx/aggregator';

export default async function HomePage() {
	const content = await getFeedContent();

	return (
		<Wrapper type="page-home">
			<div className="mb-10 content-column p-5">
				<div className="flex flex-col gap-4">
					<h1>
						An evolving, enigmatic, multifaceted creative practice, turning complex
						futures into today's narratives.
					</h1>
					<p>
						The practice questions premises before refining execution. Ask "why not
						differently?" before "how to do this better?" <br />
						Because the most interesting possibilities emerge not from optimization, but
						from questioning the premise entirely.
					</p>
					<p>
						The work moves between LAB (speculative research, public prototypes, new
						frames for understanding) and COM (strategic narrative, decision-grade
						artifacts for organizations navigating complexity). Research generates
						language; commerce deploys it. Each feeds the other, operating in the
						productive tension between chaos and order, between the mapped and the
						undiscovered.
					</p>
					<ol>
						<li>It inhabits the space between what is seen and what is felt.</li>
						<li>It finds in the unresolved not deficiency, but authenticity.</li>
						<li>It operates in the deliberate pause, dwells in the charged moment.</li>
						<li>It expresses itself... in incomplete form.</li>
					</ol>
					<p>After all, isn't true infinity always incomplete?</p>

					<nav className="flex flex-row gap-4">
						<Link href="https://instagram.com/u29dc">IG</Link>
						<Link href="https://linkedin.com/in/u29dc">LI</Link>
						<Link href="https://cal.com/u29dc">Calendar</Link>
					</nav>
				</div>
			</div>

			<div className="col-span-full space-y-5">
				{content.map((item) => (
					<FeedItem key={item.frontmatter.slug} item={item} />
				))}
			</div>
		</Wrapper>
	);
}
