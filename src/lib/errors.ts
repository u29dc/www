/**
 * Error Handling System
 *
 * ## SUMMARY
 * Typed error classes with HTTP status codes and response utilities.
 *
 * ## RESPONSIBILITIES
 * - Provide domain-specific error classes with HTTP status codes
 * - Convert errors to HTTP responses with environment-aware sanitization
 *
 * @module lib/errors
 */

import { logEvent } from '@/lib/logger';

export interface ErrorResponseOptions {
	format?: 'json' | 'text';
	headers?: HeadersInit;
}

export interface ErrorResponseData {
	error: {
		code: string;
		message: string;
		statusCode: number;
		stack?: string;
	};
}

// ==================================================
// ERROR CLASSES
// ==================================================

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

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(404, `${resource} not found`, 'NOT_FOUND');
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(400, message, 'VALIDATION_ERROR');
	}
}

export class ForbiddenError extends AppError {
	constructor(resource: string, reason?: string) {
		const message = reason
			? `Access to ${resource} forbidden: ${reason}`
			: `Access to ${resource} forbidden`;
		super(403, message, 'FORBIDDEN');
	}
}

export class ProcessingError extends AppError {
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(500, message, 'PROCESSING_ERROR');
	}
}

// ==================================================
// RESPONSE UTILITIES
// ==================================================

function errorToData(error: AppError | Error): ErrorResponseData {
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (error instanceof AppError) {
		return {
			error: {
				code: error.code || error.name,
				message: error.message,
				statusCode: error.statusCode,
				...(isDevelopment && error.stack ? { stack: error.stack } : {}),
			},
		};
	}

	return {
		error: {
			code: 'INTERNAL_SERVER_ERROR',
			message: isDevelopment ? error.message : 'An unexpected error occurred',
			statusCode: 500,
			...(isDevelopment && error.stack ? { stack: error.stack } : {}),
		},
	};
}

/**
 * Creates HTTP Response from error with consistent formatting.
 * @param error - Error to convert
 * @param options - Response options
 * @returns HTTP Response
 */
export function createErrorResponse(
	error: AppError | Error,
	options: ErrorResponseOptions = {},
): Response {
	const { format = 'json', headers: customHeaders = {} } = options;

	const errorData = errorToData(error);
	const statusCode = error instanceof AppError ? error.statusCode : 500;
	const errorCode = errorData.error.code;

	logEvent('ERROR', 'RESPONSE', 'CREATE', {
		code: errorCode,
		status: statusCode,
		message: error.message,
		...(error instanceof AppError && error.code ? { errorCode: error.code } : {}),
	});

	const baseHeaders: HeadersInit = {
		'Cache-Control': 'no-store, no-cache, must-revalidate',
		'X-Content-Type-Options': 'nosniff',
		...customHeaders,
	};

	if (format === 'text') {
		return new Response(errorData.error.message, {
			status: statusCode,
			headers: {
				...baseHeaders,
				'Content-Type': 'text/plain; charset=utf-8',
			},
		});
	}

	return new Response(JSON.stringify(errorData, null, 2), {
		status: statusCode,
		headers: {
			...baseHeaders,
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}
