/**
 * Utility Types
 *
 * ## SUMMARY
 * Reusable utility types for infrastructure, theming, logging, and security.
 * Centralized type library for non-component application utilities.
 *
 * ## RESPONSIBILITIES
 * - Provide theme-related types and context values
 * - Define logger infrastructure types
 * - Export security policy types (CSP)
 * - Support utility functions (class names, metadata formatting)
 *
 * ## USAGE
 * ```typescript
 * import type { Theme, LoggerInstance, ClassValue } from '@/lib/types/utils';
 *
 * const logger: LoggerInstance = createLogger();
 * const classes: ClassValue = ['base', 'active'];
 * ```
 *
 * @module lib/types/utils
 */

import type { ReactNode } from 'react';

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

// =============================================================================
// Class Utilities
// =============================================================================

/**
 * ClassValue represents valid className input types for class manipulation utilities
 */
export type ClassValue =
	| string
	| number
	| boolean
	| undefined
	| null
	| ClassValue[]
	| Record<string, boolean | undefined | null>;

// =============================================================================
// Metadata Formatting
// =============================================================================

/**
 * Metadata item for display (used in metadata lists and formatters)
 */
export interface MetadataItem {
	label: string;
	value: ReactNode;
}

// =============================================================================
// Logger Infrastructure
// =============================================================================

/**
 * Log metadata type (record of arbitrary key-value pairs)
 */
export type LogMeta = Record<string, unknown>;

/**
 * Logger instance interface for structured logging
 */
export interface LoggerInstance {
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, error?: unknown, meta?: LogMeta): void;
	child(bindings: LogMeta): LoggerInstance;
}

// =============================================================================
// Security Infrastructure
// =============================================================================

/**
 * Content Security Policy directive definition
 */
export type CspDirective = {
	name: string;
	values: string[];
};
