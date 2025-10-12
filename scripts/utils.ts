#!/usr/bin/env bun

/**
 * Shared Script Utilities
 */

/**
 * ANSI color codes for terminal output
 * Using standard 16-color palette for maximum compatibility
 */
export const colors = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
} as const;

/**
 * Status indicators for consistent output formatting
 */
export const status = {
	success: `${colors.green}[OK]${colors.reset}`,
	error: `${colors.red}[FAIL]${colors.reset}`,
	warning: `${colors.yellow}[WARN]${colors.reset}`,
	info: `${colors.blue}[INFO]${colors.reset}`,
	skip: `${colors.dim}[SKIP]${colors.reset}`,
} as const;

/**
 * Format milliseconds into human-readable duration
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;

	const minutes = Math.floor(ms / 60000);
	const seconds = Math.round((ms % 60000) / 1000);
	return `${minutes}m ${seconds}s`;
}

/**
 * Timer utility for measuring script performance
 */
export class Timer {
	private readonly startTime: number;

	constructor() {
		this.startTime = performance.now();
	}

	/**
	 * Get elapsed time since timer started
	 */
	elapsed(): number {
		return performance.now() - this.startTime;
	}

	/**
	 * Get elapsed time as formatted string
	 */
	elapsedFormatted(): string {
		return formatDuration(this.elapsed());
	}
}

/**
 * Print a formatted section divider
 */
export function printSection(title: string, width = 40): void {
	console.log(`\n${colors.bold}${title.toUpperCase()}${colors.reset}`);
	console.log('─'.repeat(width));
}

/**
 * Format an error message with context
 */
export function formatError(error: unknown, context?: string): string {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const contextStr = context ? `${context}: ` : '';

	return `${status.error} ${contextStr}${errorMessage}`;
}

/**
 * Parse command line arguments into flags
 */
export function parseFlags(args: string[] = process.argv.slice(2)): Set<string> {
	const flags = new Set<string>();

	for (const arg of args) {
		if (arg.startsWith('--')) {
			flags.add(arg.slice(2));
		} else if (arg.startsWith('-') && arg.length > 1) {
			// Support both -abc and --flag formats
			for (const char of arg.slice(1)) {
				flags.add(char);
			}
		}
	}

	return flags;
}

/**
 * Run an async function with error handling
 */
export async function runScript(fn: () => Promise<void>, scriptName = 'Script'): Promise<void> {
	try {
		await fn();
	} catch (error) {
		console.error(formatError(error, scriptName));
		process.exit(1);
	}
}
