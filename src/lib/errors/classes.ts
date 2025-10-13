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

/**
 * 400 Bad Request - Validation failure
 */
export class ValidationError extends AppError {
	constructor(message: string) {
		super(400, message, 'VALIDATION_ERROR');
	}
}

/**
 * 500 Internal Server Error - Processing failure
 */
export class ProcessingError extends AppError {
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(500, message, 'PROCESSING_ERROR');
	}
}
