#!/usr/bin/env bun

/**
 * dev.ts - Development orchestrator with timestamp logging
 *
 * Runs Next.js development server with enhanced logging.
 *
 * Usage:
 *   bun scripts/dev.ts       # Run development server
 *   bun run dev:full         # Via package.json script
 */

import { spawn } from 'bun';
import { colors, formatError, printSection, runScript, status, Timer } from './utils';

/**
 * Threshold for clock drift correction (milliseconds)
 * Re-sync wall clock if drift exceeds this value
 */
const CLOCK_DRIFT_THRESHOLD_MS = 5;

const formatTimestamp = (() => {
	const pad = (value: number, digits: number): string => value.toString().padStart(digits, '0');
	let referenceWallMs = Date.now();
	let referencePerfMs = performance.now();

	return (): string => {
		const currentPerfMs = performance.now();
		let preciseMs = referenceWallMs + (currentPerfMs - referencePerfMs);

		const wallNow = Date.now();
		if (Math.abs(wallNow - preciseMs) > CLOCK_DRIFT_THRESHOLD_MS) {
			referenceWallMs = wallNow;
			referencePerfMs = currentPerfMs;
			preciseMs = wallNow;
		}

		const wholeMs = Math.floor(preciseMs);
		const timestamp = new Date(wholeMs);
		const hours = pad(timestamp.getHours(), 2);
		const minutes = pad(timestamp.getMinutes(), 2);
		const seconds = pad(timestamp.getSeconds(), 2);
		const milliseconds = pad(timestamp.getMilliseconds(), 3);
		return `${hours}:${minutes}:${seconds}.${milliseconds}`;
	};
})();

class DevServer {
	private process?: ReturnType<typeof Bun.spawn>;
	private isShuttingDown = false;
	private timer: Timer;
	private stdoutBuffer = '';
	private stderrBuffer = '';

	constructor() {
		this.timer = new Timer();
		this.setupSignalHandlers();
	}

	private setupSignalHandlers(): void {
		const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const;

		for (const signal of signals) {
			process.on(signal, () => {
				if (!this.isShuttingDown) {
					this.isShuttingDown = true;
					this.logMessage('Shutting down development server...');
					this.shutdown();
				}
			});
		}
	}

	private logMessage(message: string): void {
		const timestamp = formatTimestamp();
		console.log(
			`${colors.dim}${timestamp}${colors.reset} ${colors.blue}[DEV]${colors.reset} ${message}`,
		);
	}

	public async start(): Promise<void> {
		printSection('Development Environment');
		console.log(`Starting Next.js with Turbopack...`);
		console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);

		this.process = Bun.spawn(['bun', 'next', 'dev', '--turbopack'], {
			stdout: 'pipe',
			stderr: 'pipe',
			env: process.env,
		});

		// Handle stdout
		if (this.process.stdout && typeof this.process.stdout !== 'number') {
			this.streamOutput(this.process.stdout);
		}

		// Handle stderr
		if (this.process.stderr && typeof this.process.stderr !== 'number') {
			this.streamOutput(this.process.stderr, true);
		}

		// Handle process exit
		this.process.exited.then((exitCode) => {
			if (!this.isShuttingDown) {
				this.logMessage(`Process exited with code ${exitCode}`);
				this.shutdown();
			}
		});

		// Keep main process alive indefinitely while server runs
		// Process exit is handled through signal handlers and shutdown() method
		await new Promise(() => {});
	}

	private formatLogLine(line: string, isStderr: boolean): string {
		const timestamp = formatTimestamp();
		const label = isStderr ? '[STDERR]' : '[NEXTJS]';
		const displayColor = isStderr ? colors.dim : colors.blue;
		return `${colors.dim}${timestamp}${colors.reset} ${displayColor}${label}${colors.reset} ${line}`;
	}

	private processStreamChunk(text: string, isStderr: boolean): void {
		const buffer = isStderr ? 'stderrBuffer' : 'stdoutBuffer';
		this[buffer] += text;

		const lines = this[buffer].split('\n');
		// Keep the last partial line in buffer
		this[buffer] = lines.pop() || '';

		for (const line of lines) {
			if (line.trim()) {
				console.log(this.formatLogLine(line, isStderr));
			}
		}
	}

	private flushBuffer(isStderr: boolean): void {
		const buffer = isStderr ? 'stderrBuffer' : 'stdoutBuffer';
		if (this[buffer].trim()) {
			console.log(this.formatLogLine(this[buffer], isStderr));
			this[buffer] = '';
		}
	}

	private async streamOutput(
		stream: ReadableStream<Uint8Array>,
		isStderr = false,
	): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				if (value) {
					const text = decoder.decode(value, { stream: true });
					this.processStreamChunk(text, isStderr);
				}
			}
		} catch (error) {
			// Stream can close abruptly during shutdown - this is expected
			if (!this.isShuttingDown) {
				this.logMessage(
					`Stream error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} finally {
			this.flushBuffer(isStderr);
			reader.releaseLock();
		}
	}

	private async shutdown(): Promise<void> {
		if (this.process) {
			try {
				this.process.kill('SIGTERM');
				await this.process.exited;
				this.logMessage('Stopped');
			} catch (error) {
				console.error(formatError(error, 'Error stopping server'));
			}
		}

		// Run cleanup after server stops
		try {
			this.logMessage('Cleaning build artifacts...');
			const cleanProc = spawn(['bun', 'scripts/clean.ts'], {
				stdout: 'ignore',
				stderr: 'ignore',
				env: process.env,
			});

			await cleanProc.exited;

			if (cleanProc.exitCode !== 0) {
				this.logMessage('Cleanup completed with warnings');
			} else {
				this.logMessage('Cleanup complete');
			}
		} catch (error) {
			// Non-blocking: cleanup failure shouldn't prevent shutdown
			const message = error instanceof Error ? error.message : String(error);
			this.logMessage(`Cleanup failed (non-critical): ${message}`);
		}

		console.log(
			`\n${status.success} Development environment stopped ${colors.dim}(${this.timer.elapsedFormatted()})${colors.reset}`,
		);
		process.exit(0);
	}
}

async function main(): Promise<void> {
	const server = new DevServer();
	await server.start();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	runScript(main, 'dev');
}
