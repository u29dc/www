/**
 * MDX Components Utility
 *
 * ## SUMMARY
 * Re-exports MDX components from root level for use in src/ directory.
 * Enables absolute imports while maintaining root-level mdx-components.tsx requirement.
 *
 * ## RESPONSIBILITIES
 * - Re-export useMDXComponents from root
 * - Enable @/ import paths for MDX component configuration
 *
 * ## USAGE
 * ```tsx
 * import { useMDXComponents } from '@/lib/mdx/components';
 * const components = useMDXComponents({});
 * ```
 *
 * @module lib/mdx/components
 */

export { useMDXComponents } from '@/../mdx-components';
