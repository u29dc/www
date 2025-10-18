/**
 * Class Utilities
 *
 * ## SUMMARY
 * Utility functions for className manipulation and merging with type safety.
 *
 * ## RESPONSIBILITIES
 * - Merge multiple className strings efficiently
 * - Handle conditional className application
 * - Remove duplicate className values
 *
 * ## USAGE
 * ```typescript
 * import { cn } from '@/lib/utils/class';
 * const className = cn('base-class', isActive && 'active', 'another-class');
 * ```
 *
 * @module lib/utils/class
 */

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

// Converts ClassValue input to flat className string
function toClassString(value: ClassValue): string {
	if (!value) return '';

	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);

	if (Array.isArray(value)) {
		return value
			.map((v) => toClassString(v))
			.filter(Boolean)
			.join(' ');
	}

	if (typeof value === 'object') {
		return Object.entries(value)
			.filter(([, v]) => Boolean(v))
			.map(([k]) => k)
			.join(' ');
	}

	return '';
}

/**
 * Merges className strings with deduplication
 *
 * @param inputs - Variable number of className inputs
 * @returns Merged className string without duplicates
 */
export function cn(...inputs: ClassValue[]): string {
	const classNames = inputs.map((input) => toClassString(input)).filter(Boolean);

	if (classNames.length === 0) return '';

	// Remove duplicates while preserving order
	const seen = new Set<string>();
	const result: string[] = [];

	for (const className of classNames.join(' ').split(/\s+/)) {
		if (className && !seen.has(className)) {
			seen.add(className);
			result.push(className);
		}
	}

	return result.join(' ');
}
