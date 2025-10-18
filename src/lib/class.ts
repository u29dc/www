/**
 * Class Utilities
 *
 * ## SUMMARY
 * Utility functions for className manipulation and merging with type safety.
 *
 * ## RESPONSIBILITIES
 * - Merge className strings with conditional support and deduplication
 *
 * @module lib/class
 */

export type ClassValue =
	| string
	| number
	| boolean
	| undefined
	| null
	| ClassValue[]
	| Record<string, boolean | undefined | null>;

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
 * Merges className strings with deduplication.
 * @param inputs - Variable className inputs
 * @returns Merged className string
 */
export function cn(...inputs: ClassValue[]): string {
	const classNames = inputs.map((input) => toClassString(input)).filter(Boolean);

	if (classNames.length === 0) return '';

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
