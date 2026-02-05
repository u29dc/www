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
		const message = reason ? `Access to ${resource} forbidden: ${reason}` : `Access to ${resource} forbidden`;
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

export function errorToData(error: AppError | Error): ErrorResponseData {
	const env = typeof process !== 'undefined' ? (process.env as { NODE_ENV?: string }) : undefined;
	const isDevelopment = env?.NODE_ENV === 'development';

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
