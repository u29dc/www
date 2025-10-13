/**
 * Component Type Definitions
 *
 * ## SUMMARY
 * TypeScript types and interfaces for React components, props, and UI-specific types.
 * Centralized type library for all component prop definitions and UI domain types.
 *
 * ## RESPONSIBILITIES
 * - Define component prop interfaces for consistent API contracts
 * - Export UI-specific type literals and enums
 * - Provide React context value types for component communication
 * - Enable type safety across component hierarchy
 *
 * ## USAGE
 * ```tsx
 * import type { BlurGradientProps, HeaderProps } from '@/lib/types/components';
 *
 * export function MyComponent(props: BlurGradientProps) {
 *   // Implementation
 * }
 * ```
 *
 * @module lib/types/components
 */

import type { ReactNode } from 'react';
import type { ContentItem, ParsedContent } from '@/lib/types/content';

// =============================================================================
// Layout Component Props
// =============================================================================

/**
 * Root layout component props
 */
export interface RootLayoutProps {
	children: ReactNode;
}

/**
 * Content page component props (dynamic route)
 */
export interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

/**
 * Wrapper component props
 */
export interface WrapperProps {
	type: 'page-home' | 'page-content';
	children: ReactNode;
	frontmatter?: ContentItem;
}

// =============================================================================
// UI Component Props
// =============================================================================

/**
 * Position for blur gradient effect
 */
export type BlurPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Distribution curve for blur progression
 */
export type BlurCurve = 'linear' | 'ease-in' | 'ease-out' | 'bezier';

/**
 * Blur gradient component props
 */
export interface BlurGradientProps {
	/** Position of the blur effect */
	position?: BlurPosition;
	/** Blur intensity multiplier (0-5 recommended) */
	strength?: number;
	/** Size of the blur area (CSS unit) */
	size?: string;
	/** Number of blur layers to generate */
	layers?: number;
	/** Distribution curve for blur progression */
	curve?: BlurCurve;
	/** Use exponential blur progression for more dramatic ramp-up */
	exponential?: boolean;
	/** Enable scroll-triggered fade-in animation */
	animated?: boolean;
	/** Overall opacity of the effect */
	opacity?: number;
	/** Use fixed positioning (viewport-level) instead of absolute (parent-relative) */
	fixed?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Optional children to render above blur layers */
	children?: ReactNode;
}

/**
 * Feed item component props
 */
export interface FeedItemProps {
	item: ParsedContent;
}

/**
 * Header component props
 */
export interface HeaderProps {
	type: 'page-home' | 'page-content';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

/**
 * Metadata list component props
 */
export interface MetadataListProps {
	frontmatter: ContentItem;
	className?: string;
}

// =============================================================================
// MDX Component Props
// =============================================================================

/**
 * MDX content block component props
 */
export interface MdxContentBlockProps {
	children: ReactNode;
}

/**
 * MDX media container component props
 * Accepts array of media sources
 */
export interface MdxMediaProps {
	/** Array of media sources (always array, even for single item) */
	src: string[];
	/** Optional alt text applied to all media items */
	alt?: string;
}

/**
 * MDX media item component props
 */
export interface MdxMediaItemProps {
	src: string;
	alt?: string;
}

/**
 * Media layout context value for aspect ratio-based flexbox layout
 */
export interface MediaLayoutContextValue {
	registerItem: (id: string, aspectRatio: number) => void;
	getFlexBasis: (id: string) => string;
}
