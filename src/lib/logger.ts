import pino from 'pino';
import { browser, dev } from '$app/environment';

export type LogMeta = Record<string, unknown>;

export interface LoggerInstance {
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, error?: unknown, meta?: LogMeta): void;
	child(bindings: LogMeta): LoggerInstance;
}

class PinoLoggerWrapper implements LoggerInstance {
	private pinoLogger: pino.Logger;

	constructor(pinoLogger: pino.Logger) {
		this.pinoLogger = pinoLogger;
	}

	private shouldLog(): boolean {
		if (dev) return true;
		return !browser;
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
	if (browser) {
		return new PinoLoggerWrapper(
			pino({
				level: dev ? 'debug' : 'silent',
				browser: { asObject: true },
			}),
		);
	}

	return new PinoLoggerWrapper(
		pino({
			level: dev ? 'debug' : 'info',
		}),
	);
}

export const logger = createLogger();

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

export function createRequestLogger(requestId: string, context?: LogMeta): LoggerInstance {
	return logger.child({
		requestId,
		...context,
	});
}
