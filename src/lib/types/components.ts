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
 * import type { BaseGradientBlurProps, ComposedLayoutHeaderProps } from '@/lib/types/components';
 *
 * export function MyComponent(props: BaseGradientBlurProps) {
 *   // Implementation
 * }
 * ```
 *
 * @module lib/types/components
 */

import type { ReactNode } from 'react';
import type { ContentItem, ParsedContent } from '@/lib/types/content';

// Layout Component Props

/** Root layout component props */
export interface RootLayoutProps {
	children: ReactNode;
}

/** Content page component props (dynamic route) */
export interface ContentPageProps {
	params: Promise<{ slug: string }>;
}

/** Composed layout wrapper component props */
export interface ComposedLayoutWrapperProps {
	type: 'page-home' | 'page-content';
	children: ReactNode;
	frontmatter?: ContentItem;
}

// UI Component Props

/** Position for blur gradient effect */
export type BlurPosition = 'top' | 'bottom' | 'left' | 'right';

/** Distribution curve for blur progression */
export type BlurCurve = 'linear' | 'ease-in' | 'ease-out' | 'bezier';

/** Base gradient blur component props */
export interface BaseGradientBlurProps {
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

/** Base brand logo component props */
export interface BaseBrandLogoProps {
	/** Overall width in pixels (height auto-calculated to maintain 4:1 ratio) */
	width?: number;
	/** Where default blur starts horizontally (0 = left edge, 1 = right edge) */
	blurStart?: number;
	/** Intensity of default horizontal blur gradient */
	defaultBlurIntensity?: number;
	/** Intensity of mouse hover blur effect */
	mouseBlurIntensity?: number;
	/** Size of mouse blur circle */
	mouseBlurSize?: number;
	/** Corner roundness of rectangle */
	roundness?: number;
	/** Additional CSS classes for container */
	className?: string;
}

/** WebGL setup state for logo blur rendering */
export interface WebGLSetup {
	/** Compiled WebGL shader program */
	program: WebGLProgram;
	/** Buffer containing vertex position data */
	positionBuffer: WebGLBuffer;
	/** Uniform variable locations for shader parameters */
	uniformLocations: {
		mouse: WebGLUniformLocation | null;
		resolution: WebGLUniformLocation | null;
		pixelRatio: WebGLUniformLocation | null;
		rectWidth: WebGLUniformLocation | null;
		rectHeight: WebGLUniformLocation | null;
		roundness: WebGLUniformLocation | null;
		blurStart: WebGLUniformLocation | null;
		defaultBlurIntensity: WebGLUniformLocation | null;
		mouseBlurSize: WebGLUniformLocation | null;
		mouseBlurIntensity: WebGLUniformLocation | null;
		widthSpreadMultiplier: WebGLUniformLocation | null;
		heightSpreadMultiplier: WebGLUniformLocation | null;
		color: WebGLUniformLocation | null;
	};
}

/** Composed layout header component props */
export interface ComposedLayoutHeaderProps {
	type: 'page-home' | 'page-content';
	frontmatter?: ContentItem | undefined;
	title?: string | undefined;
}

/** Internal feed item component props */
export interface FeedItemProps {
	item: ParsedContent;
}

// MDX Component Props

/** Feature MDX content component props */
export interface FeatureMdxContentProps {
	children: ReactNode;
}

/** Feature MDX media container component props */
export interface FeatureMdxMediaProps {
	/** Array of media sources (always array, even for single item) */
	src: string[];
	/** Optional alt text applied to all media items */
	alt?: string;
}

/** Feature MDX media item component props */
export interface FeatureMdxMediaItemProps {
	src: string;
	alt?: string;
}

/** Media layout context value for aspect ratio-based flexbox layout */
export interface MediaLayoutContextValue {
	registerItem: (id: string, aspectRatio: number) => void;
	getFlexBasis: (id: string) => string;
}

// Animation Component Props

/** Animation trigger mode for animation reveal */
export type AnimationRevealTrigger = 'mount' | 'manual';

/**
 * Animation reveal component props
 *
 * ## SUMMARY
 * Dual-mode animation component: word-by-word text reveal OR element-by-element stagger.
 * Automatically detects mode based on children structure. Optimized for 60fps performance
 * with GPU acceleration and accessibility support.
 *
 * ## RESPONSIBILITIES
 * - Auto-detect animation mode (word vs element) from children structure
 * - Split text into animatable word spans while preserving whitespace
 * - Orchestrate nested staggered animation timing (elements → words)
 * - Handle blur, opacity, and transform animations with Motion
 * - Respect prefers-reduced-motion for accessibility
 * - Provide flexible trigger modes (mount/manual)
 *
 * ## USAGE
 * ```tsx
 * // Word mode: Simple text (current behavior)
 * <BaseAnimationReveal>Welcome to the experience</BaseAnimationReveal>
 *
 * // Element mode: Multiple elements with nested word animation
 * <BaseAnimationReveal elementStagger={200}>
 *   <h2>First line animates at 0ms</h2>
 *   <h2>Second line animates at 200ms</h2>
 *   <h2>Third line animates at 400ms</h2>
 * </BaseAnimationReveal>
 *
 * // Element mode with custom word stagger
 * <BaseAnimationReveal elementStagger={300} staggerDelay={30}>
 *   <p>Elements stagger by 300ms</p>
 *   <p>Words within stagger by 30ms</p>
 * </BaseAnimationReveal>
 *
 * // Custom animation parameters
 * <BaseAnimationReveal blurStrength={12} yOffset={24} baseOpacity={0.2}>
 *   More dramatic reveal
 * </BaseAnimationReveal>
 *
 * // No blur, only opacity and motion
 * <BaseAnimationReveal enableBlur={false}>Subtle fade-up</BaseAnimationReveal>
 *
 * // Manual trigger mode
 * <BaseAnimationReveal trigger="manual" shouldAnimate={isReady}>
 *   Controlled animation
 * </BaseAnimationReveal>
 * ```
 *
 * ## KEY FLOWS
 * ### Word Mode (no React elements in children)
 * 1. Component mounts → Text split into word spans
 * 2. Animation starts based on trigger mode (mount/manual)
 * 3. Container applies stagger delay to children
 * 4. Each word animates: blur(X) → blur(0), opacity(base) → opacity(1), translateY(X) → translateY(0)
 *
 * ### Element Mode (React elements detected in children)
 * 1. Component mounts → Elements extracted, text within each element split into words
 * 2. Top container staggers elements by elementStagger
 * 3. Each element container staggers words by staggerDelay
 * 4. Nested animation: element appears → words within reveal sequentially
 *
 * ### Both Modes
 * 5. GPU acceleration via transform/opacity/filter with will-change hint
 * 6. Reduced motion: instant reveal without animation
 *
 * ## LIMITATIONS
 * - Element mode only supports direct text children within each element
 * - Nested/complex element structures will be converted to strings
 * - For deeply nested content, use multiple AnimationReveal instances
 */
export interface BaseAnimationRevealProps {
	/** Text content or React elements to animate */
	children: ReactNode;
	/** Initial delay before animation starts in milliseconds (default: 0) */
	delay?: number;
	/** Delay between each word animation in milliseconds (default: 10) */
	staggerDelay?: number;
	/** Delay between each element animation in milliseconds (default: 0, disabled). When > 0 and children contain React elements, enables element-by-element stagger mode */
	elementStagger?: number;
	/** Animation duration per word in seconds (default: 1.5) */
	duration?: number;
	/** Toggle blur effect (default: true) */
	enableBlur?: boolean;
	/** Blur intensity in pixels (default: 10) */
	blurStrength?: number;
	/** Upward movement distance in pixels (default: 5) */
	yOffset?: number;
	/** Starting opacity 0-1 (default: 0) */
	baseOpacity?: number;
	/** Additional CSS classes for container */
	className?: string;
	/** Additional CSS classes for text spans */
	textClassName?: string;
	/** Animation trigger mode (default: 'mount') */
	trigger?: AnimationRevealTrigger;
	/** Manual trigger control when trigger='manual' (default: true) */
	shouldAnimate?: boolean;
	/** Callback fired when all animations complete. Uses multi-layer detection: Motion events + calculated timeout + reduced-motion handling. Guaranteed to fire exactly once. */
	onFinished?: () => void;
}
