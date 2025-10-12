/**
 * Utility Types
 *
 * ## SUMMARY
 * Reusable utility types for common type transformations and compositions.
 *
 * ## RESPONSIBILITIES
 * - Provide type-safe utility transformations
 * - Enable conditional type logic
 * - Support generic type constraints
 *
 * ## USAGE
 * ```typescript
 * import type { Nullable, DeepPartial } from '@/lib/types/utils';
 * type User = { id: string; name: string };
 * type OptionalUser = DeepPartial<User>;
 * ```
 *
 * @module lib/types/utils
 */

/**
 * Available theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Resolved theme value (system resolved to actual theme)
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Theme context value for provider
 */
export interface ThemeContextValue {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
}

/**
 * Props for theme provider component
 */
export interface ThemeProviderProps {
	children: React.ReactNode;
	initialTheme?: Theme;
	initialResolved?: ResolvedTheme;
}
