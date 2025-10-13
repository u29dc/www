/**
 * Input Validators
 *
 * ## SUMMARY
 * Security-focused validation utilities for URL slugs and user input.
 * Prevents path traversal, injection attacks, and DoS via input validation.
 *
 * ## RESPONSIBILITIES
 * - Validate URL slug format and length
 * - Prevent path traversal attacks
 * - Sanitize user input
 * - Log validation failures for monitoring
 *
 * ## USAGE
 * ```typescript
 * import { validateSlug } from '@/lib/utils/validators';
 * const slug = validateSlug(rawSlug); // Throws ValidationError if invalid
 * ```
 *
 * @module lib/utils/validators
 */

import path from 'node:path';
import { ValidationError } from '@/lib/utils/errors';
import { logEvent } from '@/lib/utils/logger';

/** Slug pattern: lowercase alphanumeric and hyphens only */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Maximum slug length to prevent DoS */
const MAX_SLUG_LENGTH = 100;

/** Tests if slug matches allowed pattern */
export function isValidSlugFormat(slug: string): boolean {
	return SLUG_PATTERN.test(slug);
}

/** Checks that resolved path stays within content directory (path traversal prevention) */
export function isValidContentPath(slug: string): boolean {
	const contentDir = path.join(process.cwd(), 'src/content');
	const resolvedPath = path.resolve(path.join(contentDir, `${slug}.mdx`));

	return resolvedPath.startsWith(contentDir);
}

/**
 * Validates and sanitizes URL slug with comprehensive security checks
 *
 * @param rawSlug - Raw slug from URL params (may be URL-encoded)
 * @returns Sanitized slug if valid
 * @throws {ValidationError} If slug fails any validation check
 *
 * @example
 * ```typescript
 * const slug = validateSlug('my-post');  // Returns: 'my-post'
 * validateSlug('../etc/passwd');         // Throws: ValidationError
 * validateSlug('a'.repeat(150));         // Throws: ValidationError (too long)
 * ```
 */
export function validateSlug(rawSlug: string): string {
	// Step 1: URL decode
	let slug: string;
	try {
		slug = decodeURIComponent(rawSlug);
	} catch {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'DECODE_ERROR', {
			rawSlug: rawSlug.substring(0, 50),
		});
		throw new ValidationError('Invalid URL encoding in slug');
	}

	// Step 2: Length validation
	if (slug.length === 0) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'EMPTY_SLUG', { rawSlug });
		throw new ValidationError('Slug cannot be empty');
	}

	if (slug.length > MAX_SLUG_LENGTH) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'TOO_LONG', {
			length: slug.length,
			max: MAX_SLUG_LENGTH,
			slug: slug.substring(0, 50),
		});
		throw new ValidationError(`Slug exceeds maximum length of ${MAX_SLUG_LENGTH} characters`);
	}

	// Step 3: Format validation
	if (!isValidSlugFormat(slug)) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'INVALID_FORMAT', {
			slug: slug.substring(0, 50),
			pattern: SLUG_PATTERN.source,
		});
		throw new ValidationError('Slug must contain only lowercase letters, numbers, and hyphens');
	}

	// Step 4: Path traversal check
	if (!isValidContentPath(slug)) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'PATH_TRAVERSAL', {
			slug: slug.substring(0, 50),
		});
		throw new ValidationError('Slug contains invalid path components');
	}

	return slug;
}

/** Safe wrapper for validateSlug that returns null instead of throwing */
export function validateSlugSafe(rawSlug: string): string | null {
	try {
		return validateSlug(rawSlug);
	} catch {
		return null;
	}
}
