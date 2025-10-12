/**
 * MDX Components Utility
 *
 * ## SUMMARY
 * Re-exports MDX components from root level for use in src/ directory.
 * Enables absolute imports while maintaining root-level mdx-components.tsx requirement.
 *
 * ## USAGE
 * ```tsx
 * import { useMDXComponents } from '@/lib/utils/mdx-components';
 * const components = useMDXComponents({});
 * ```
 */

export { useMDXComponents } from '@/../mdx-components';
