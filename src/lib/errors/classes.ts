/**
 * Error Classes
 *
 * ## SUMMARY
 * Typed error class hierarchy with HTTP status codes for structured error handling.
 *
 * ## RESPONSIBILITIES
 * - Provide domain-specific error classes
 * - Map errors to HTTP status codes
 * - Enable type-safe error handling
 *
 * ## USAGE
 * ```typescript
 * import { NotFoundError } from '@/lib/errors/classes';
 * if (!user) throw new NotFoundError('User');
 * ```
 *
 * @module lib/errors/classes
 */

/**
 * Base operational error class with HTTP status code
 */
export class AppError extends Error {
	public readonly isOperational: boolean = true;

	constructor(
		public readonly statusCode: number,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(404, `${resource} not found`, 'NOT_FOUND');
	}
}
