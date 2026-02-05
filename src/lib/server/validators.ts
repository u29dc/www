/**
 * Input validation utilities for content routing.
 *
 * ## Security: Confidentiality Checks
 *
 * Content items may be marked confidential in their frontmatter. The following
 * locations enforce confidentiality:
 *
 * 1. **Page routes** (`src/routes/[slug]/+page.server.ts`):
 *    - Checks `frontmatter.confidential` before serving HTML pages
 *    - Returns 404 for confidential content
 *
 * 2. **Raw endpoints** (`src/lib/server/raw.ts`):
 *    - `isConfidentialContent()` filters confidential items from raw output
 *    - Returns 403 for direct confidential slug access
 *
 * 3. **Sitemap** (`src/lib/server/metadata.ts`):
 *    - Excludes confidential slugs from sitemap.xml
 *
 * ## Adding New Routes
 *
 * When creating new routes that serve content:
 * 1. Import content via `getContent()` or `getContentBySlug()`
 * 2. Check `frontmatter.confidential === true` before serving
 * 3. Return appropriate error (404/403) for confidential items
 * 4. Test: request a known confidential slug and verify rejection
 */
import { ValidationError } from '$lib/errors';
import { logEvent } from '$lib/server/logger';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const MAX_SLUG_LENGTH = 100;

export function isValidSlugFormat(slug: string): boolean {
	return SLUG_PATTERN.test(slug);
}

export function isValidContentPath(slug: string): boolean {
	return !slug.includes('/') && !slug.includes('\\') && !slug.includes('..');
}

export function validateSlug(rawSlug: string): string {
	let slug: string;
	try {
		slug = decodeURIComponent(rawSlug);
	} catch {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'DECODE_ERROR', {
			rawSlug: rawSlug.substring(0, 50),
		});
		throw new ValidationError('Invalid URL encoding in slug');
	}

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

	if (!isValidSlugFormat(slug)) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'INVALID_FORMAT', {
			slug: slug.substring(0, 50),
			pattern: SLUG_PATTERN.source,
		});
		throw new ValidationError('Slug must contain only lowercase letters, numbers, and hyphens');
	}

	if (!isValidContentPath(slug)) {
		logEvent('MARKDOWN', 'VALIDATE_SLUG', 'PATH_TRAVERSAL', {
			slug: slug.substring(0, 50),
		});
		throw new ValidationError('Slug contains invalid path components');
	}

	return slug;
}

export function validateSlugSafe(rawSlug: string): string | null {
	try {
		return validateSlug(rawSlug);
	} catch {
		return null;
	}
}
