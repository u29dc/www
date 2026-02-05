import { AppError, type ErrorResponseOptions, errorToData } from '$lib/errors';
import { logEvent } from '$lib/server/logger';

export * from '$lib/errors';

export function createErrorResponse(error: AppError | Error, options: ErrorResponseOptions = {}): Response {
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
