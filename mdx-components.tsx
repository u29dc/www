import type { MDXComponents } from 'mdx/types';
import { MdxContent } from '@/components/ui/mdx-content';
import { MdxMedia } from '@/components/ui/mdx-media';
import { MdxMediaItem } from '@/components/ui/mdx-media-item';

/**
 * MDX Components Configuration
 *
 * ## SUMMARY
 * Provides custom React components for MDX content rendering.
 * CRITICAL: Must be at project root, not in src/ directory.
 *
 * ## USAGE
 * Automatically used by Next.js MDX integration.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		h1: ({ children }) => <h1>{children}</h1>,
		h2: ({ children }) => <h2>{children}</h2>,
		h3: ({ children }) => <h3>{children}</h3>,
		p: ({ children }) => <p>{children}</p>,
		ul: ({ children }) => <ul>{children}</ul>,
		ol: ({ children }) => <ol>{children}</ol>,
		li: ({ children }) => <li>{children}</li>,
		a: ({ href, children }) => <a href={href}>{children}</a>,
		MdxContent,
		MdxMedia,
		MdxMediaItem,
		...components,
	};
}
