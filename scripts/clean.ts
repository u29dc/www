#!/usr/bin/env bun

/**
 * clean.ts - Development environment cleanup
 *
 * Removes build artifacts and kills development server processes.
 *
 * Usage:
 *   bun scripts/clean.ts              # Clean artifacts and kill ports
 *   bun scripts/clean.ts --skip-ports # Clean artifacts only
 *   bun run util:clean                # Via package.json script
 */

import { rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { Glob, spawn } from 'bun';
import { colors, parseFlags, printSection, runScript, status, Timer } from './utils';

type RemovalResult = {
	path: string;
	removed: boolean;
	error?: string;
};

const CLEAN_PATHS = ['.next', 'out', 'dist', 'build'] as const;
const CLEAN_PATTERNS = ['*.tsbuildinfo'] as const;
const CLEAN_PORTS = [3000, 3001, 3002, 3003] as const;
const PROCESS_KILL_GRACE_PERIOD_MS = 100;

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return false;
		}
		throw error;
	}
}

async function removePath(path: string): Promise<RemovalResult> {
	const exists = await pathExists(path);
	if (!exists) {
		return { path, removed: false };
	}

	try {
		await rm(path, { recursive: true, force: true });
		return { path, removed: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { path, removed: false, error: message };
	}
}

async function killPortProcess(port: number): Promise<boolean> {
	try {
		const proc = spawn(['lsof', `-i:${port}`, '-t'], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		if (proc.exitCode !== 0 || !output.trim()) {
			return false;
		}

		const pid = Number.parseInt(output.trim(), 10);
		if (!Number.isNaN(pid)) {
			try {
				process.kill(pid, 'SIGTERM');
				await Bun.sleep(PROCESS_KILL_GRACE_PERIOD_MS);
				return true;
			} catch {
				return false;
			}
		}

		return false;
	} catch {
		return false;
	}
}

function queueRemoval(targetPath: string, label?: string): Promise<RemovalResult> {
	const absolutePath = isAbsolute(targetPath) ? targetPath : join(process.cwd(), targetPath);
	return removePath(absolutePath).then((result) => ({
		...result,
		path: label ?? relative(process.cwd(), absolutePath),
	}));
}

function queueArtifactRemovals(): Promise<RemovalResult>[] {
	const removalTasks: Promise<RemovalResult>[] = [];

	// Clean directories
	for (const dir of CLEAN_PATHS) {
		const fullPath = join(process.cwd(), dir);
		removalTasks.push(queueRemoval(fullPath, dir));
	}

	// Find and clean files matching patterns
	for (const pattern of CLEAN_PATTERNS) {
		const glob = new Glob(pattern);
		const files = Array.from(glob.scanSync());
		for (const file of files) {
			removalTasks.push(queueRemoval(file));
		}
	}

	return removalTasks;
}

async function cleanPorts(): Promise<number> {
	const killResults = await Promise.all(
		CLEAN_PORTS.map(async (port) => {
			const killed = await killPortProcess(port);
			return { port, killed };
		}),
	);

	let portsKilled = 0;
	for (const { port, killed } of killResults) {
		if (killed) {
			portsKilled++;
			console.log(`${status.success} Port ${colors.cyan}${port}${colors.reset} cleared`);
		}
	}

	return portsKilled;
}

function reportRemovalResults(removalResults: RemovalResult[]): {
	cleanedCount: number;
	failureCount: number;
} {
	let cleanedCount = 0;
	let failureCount = 0;

	for (const { path, removed, error } of removalResults) {
		if (removed) {
			console.log(`${status.success} Removed: ${colors.cyan}${path}${colors.reset}`);
			cleanedCount++;
		} else if (error) {
			console.log(
				`${status.error} Failed: ${colors.cyan}${path}${colors.reset} ${colors.dim}- ${error}${colors.reset}`,
			);
			failureCount++;
		}
	}

	return { cleanedCount, failureCount };
}

function printCleanupSummary(
	cleanedCount: number,
	portsKilled: number,
	failureCount: number,
	skipPorts: boolean,
	timer: Timer,
): void {
	console.log(`\n${colors.bold}Cleanup complete!${colors.reset}`);
	const portSummary = skipPorts ? '' : `, ports: ${portsKilled} cleared`;
	console.log(
		`  ${colors.green}Artifacts:${colors.reset} ${cleanedCount} cleaned${portSummary}\n` +
			`  ${colors.blue}Time:${colors.reset} ${timer.elapsedFormatted()}`,
	);

	const totalActions = cleanedCount + portsKilled;
	if (failureCount > 0) {
		console.log(
			`\n${status.warning} Completed with ${failureCount} failures ${colors.dim}(${timer.elapsedFormatted()})${colors.reset}`,
		);
		process.exitCode = 1;
	} else if (totalActions > 0) {
		console.log(
			`\n${status.success} Development environment cleaned ${colors.dim}(${timer.elapsedFormatted()})${colors.reset}`,
		);
	} else {
		console.log(
			`\n${status.info} Environment already clean ${colors.dim}(${timer.elapsedFormatted()})${colors.reset}`,
		);
	}
}

async function main(): Promise<void> {
	const timer = new Timer();
	const flags = parseFlags();
	const skipPorts = flags.has('skip-ports');

	printSection('Development Cleanup');
	if (skipPorts) {
		console.log('Cleaning build artifacts only (--skip-ports)');
	} else {
		console.log('Cleaning build artifacts and development ports');
	}

	// Queue and execute artifact removals
	const removalTasks = queueArtifactRemovals();
	const removalResults = await Promise.all(removalTasks);

	// Clean ports if not skipped
	const portsKilled = skipPorts ? 0 : await cleanPorts();

	// Report results and print summary
	const { cleanedCount, failureCount } = reportRemovalResults(removalResults);
	printCleanupSummary(cleanedCount, portsKilled, failureCount, skipPorts, timer);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	runScript(main, 'clean');
}
