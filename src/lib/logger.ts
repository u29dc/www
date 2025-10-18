/**
 * Structured Logger
 *
 * ## SUMMARY
 * Environment-aware structured logging with domain-tagged [DOMAIN|ACTION|RESULT] format.
 *
 * ## RESPONSIBILITIES
 * - Provide structured logging with environment awareness (dev vs prod)
 * - Support request-scoped context propagation
 *
 * @module lib/logger
 */

import pino from 'pino';

export type LogMeta = Record<string, unknown>;

export interface LoggerInstance {
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, error?: unknown, meta?: LogMeta): void;
	child(bindings: LogMeta): LoggerInstance;
}

class PinoLoggerWrapper implements LoggerInstance {
	private pinoLogger: pino.Logger;
	private isDevelopment: boolean;
	private isBrowser: boolean;

	constructor(pinoLogger: pino.Logger) {
		this.pinoLogger = pinoLogger;
		this.isDevelopment = process.env.NODE_ENV === 'development';
		this.isBrowser = typeof window !== 'undefined';
	}

	private shouldLog(): boolean {
		if (this.isDevelopment) return true;
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

export const logger = createLogger();

/**
 * Logs structured event with domain tagging.
 * @param domain - Event domain
 * @param action - Event action
 * @param result - Event result
 * @param data - Additional metadata
 */
export function logEvent(domain: string, action: string, result: string, data?: LogMeta): void {
	const message = `[${domain}|${action}|${result}]`;

	if (result === 'FAIL' || result === 'ERROR') {
		logger.error(message, undefined, data);
	} else if (result === 'SLOW' || result === 'TIMEOUT') {
		logger.warn(message, data);
	} else {
		logger.info(message, data);
	}
}

/**
 * Creates request-scoped logger.
 * @param requestId - Unique request identifier
 * @param context - Initial context
 * @returns Request-scoped logger
 */
export function createRequestLogger(requestId: string, context?: LogMeta): LoggerInstance {
	return logger.child({
		requestId,
		...context,
	});
}
