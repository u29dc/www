/**
 * Structured Logger
 *
 * ## SUMMARY
 * Environment-aware structured logging with domain-tagged format for observability.
 *
 * ## RESPONSIBILITIES
 * - Provide structured [DOMAIN|ACTION|RESULT] log format
 * - Enable environment-aware logging (dev vs prod)
 * - Support request-scoped context propagation
 * - Create searchable, parseable log streams
 *
 * ## USAGE
 * ```typescript
 * import { logger, logEvent } from '@/lib/utils/logger';
 * logger.info('User logged in', { userId: '123' });
 * logEvent('AUTH', 'LOGIN', 'SUCCESS', { userId: '123' });
 * ```
 *
 * @module lib/utils/logger
 */

import pino from 'pino';

/**
 * Log metadata type
 */
export type LogMeta = Record<string, unknown>;

/**
 * Logger instance interface
 */
export interface LoggerInstance {
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, error?: unknown, meta?: LogMeta): void;
	child(bindings: LogMeta): LoggerInstance;
}

/**
 * Pino logger wrapper with environment awareness
 */
class PinoLoggerWrapper implements LoggerInstance {
	private pinoLogger: pino.Logger;
	private isDevelopment: boolean;
	private isBrowser: boolean;

	constructor(pinoLogger: pino.Logger) {
		this.pinoLogger = pinoLogger;
		this.isDevelopment = process.env.NODE_ENV === 'development';
		this.isBrowser = typeof window !== 'undefined';
	}

	/**
	 * Determines if logging should occur based on environment
	 */
	private shouldLog(): boolean {
		// Development: Always log (server + browser)
		if (this.isDevelopment) return true;

		// Production: Only server-side logs
		return !this.isBrowser;
	}

	info(message: string, meta?: LogMeta): void {
		if (!this.shouldLog()) return;
		this.pinoLogger.info(meta, message);
	}

	warn(message: string, meta?: LogMeta): void {
		if (!this.shouldLog()) return;
		this.pinoLogger.warn(meta, message);
	}

	error(message: string, error?: unknown, meta?: LogMeta): void {
		if (!this.shouldLog()) return;

		// Normalize error for structured logging
		const errorData =
			error instanceof Error
				? {
						name: error.name,
						message: error.message,
						stack: error.stack,
					}
				: { message: String(error) };

		this.pinoLogger.error({ ...meta, error: errorData }, message);
	}

	child(bindings: LogMeta): LoggerInstance {
		return new PinoLoggerWrapper(this.pinoLogger.child(bindings));
	}
}

/**
 * Creates environment-aware logger instance
 */
function createLogger(): LoggerInstance {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const isBrowser = typeof window !== 'undefined';

	if (isBrowser) {
		return new PinoLoggerWrapper(
			pino({
				level: isDevelopment ? 'debug' : 'silent',
				browser: { asObject: true },
			}),
		);
	}

	return new PinoLoggerWrapper(
		pino({
			level: isDevelopment ? 'debug' : 'info',
		}),
	);
}

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Logs structured event with domain tagging
 *
 * @param domain - Event domain (AUTH, API, DB, etc.)
 * @param action - Event action (LOGIN, QUERY, CREATE, etc.)
 * @param result - Event result (SUCCESS, FAIL, START, etc.)
 * @param data - Additional event metadata
 */
export function logEvent(domain: string, action: string, result: string, data?: LogMeta): void {
	const message = `[${domain}|${action}|${result}]`;

	// Choose level based on result
	if (result === 'FAIL' || result === 'ERROR') {
		logger.error(message, undefined, data);
	} else if (result === 'SLOW' || result === 'TIMEOUT') {
		logger.warn(message, data);
	} else {
		logger.info(message, data);
	}
}

/**
 * Creates request-scoped logger with unique ID
 *
 * @param requestId - Unique request identifier
 * @param context - Initial request context
 * @returns Logger instance bound to request context
 */
export function createRequestLogger(requestId: string, context?: LogMeta): LoggerInstance {
	return logger.child({
		requestId,
		...context,
	});
}
