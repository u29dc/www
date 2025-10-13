/**
 * Error Response System
 *
 * Centralized error-to-HTTP-response conversion with format awareness,
 * security headers, automatic logging, and environment-aware sanitization.
 *
 * @module lib/errors/responses
 */

import { AppError } from '@/lib/errors/classes';
import type { ErrorResponseData, ErrorResponseOptions } from '@/lib/types/utils';
import { logEvent } from '@/lib/utils/logger';

/** Converts error to structured data with environment-aware sanitization */
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

	// Generic Error handling
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
 * Creates HTTP Response from error with consistent formatting and headers
 *
 * @example
 * ```typescript
 * return createErrorResponse(new NotFoundError('User'));
 * return createErrorResponse(error, { format: 'text' });
 * return createErrorResponse(error, { headers: { 'X-Custom': 'value' } });
 * ```
 */
export function createErrorResponse(
	error: AppError | Error,
	options: ErrorResponseOptions = {},
): Response {
	const { format = 'json', headers: customHeaders = {} } = options;

	// Extract error details
	const errorData = errorToData(error);
	const statusCode = error instanceof AppError ? error.statusCode : 500;
	const errorCode = errorData.error.code;

	// Log error before returning
	logEvent('ERROR', 'RESPONSE', 'CREATE', {
		code: errorCode,
		status: statusCode,
		message: error.message,
		...(error instanceof AppError && error.code ? { errorCode: error.code } : {}),
	});

	// Build response based on format
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

	// Default to JSON
	return new Response(JSON.stringify(errorData, null, 2), {
		status: statusCode,
		headers: {
			...baseHeaders,
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}
